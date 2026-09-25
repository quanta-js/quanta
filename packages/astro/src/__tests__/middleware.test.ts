import { describe, it, expect, afterEach, vi } from 'vitest';
import {
    defineStore,
    getDefaultContainer,
    resetDefaultContainer,
    type StoreContainer,
} from '@quantajs/core';
import { onRequest } from '../middleware';

let uid = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const encoder = new TextEncoder();

function context(path = '/') {
    return {
        url: new URL(`http://localhost${path}`),
        locals: {} as { quanta?: StoreContainer },
    };
}

function html(chunks: string[], headers: HeadersInit = {}) {
    return new Response(
        new ReadableStream<Uint8Array>({
            start(controller) {
                for (const chunk of chunks) {
                    controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
            },
        }),
        { headers: { 'content-type': 'text/html', ...headers } },
    );
}

/** Run the middleware with `next` standing in for Astro rendering the page. */
async function handle(
    ctx: ReturnType<typeof context>,
    next: () => Promise<Response>,
) {
    const response = (await onRequest(ctx as never, next as never)) as Response;
    return { response, text: await response.text() };
}

/** Evaluate the injected script the way a browser would. */
function snapshotOf(page: string, adopt?: () => void) {
    const match = /<script data-astro-rerun>(.*?)<\/script>/s.exec(page);
    if (!match) return undefined;
    const window: { __QUANTA__?: unknown; __QUANTA_ADOPT__?: () => void } = {
        __QUANTA_ADOPT__: adopt,
    };
    new Function('window', match[1])(window);
    return window.__QUANTA__ as Record<string, Record<string, unknown>>;
}

const defineCart = () =>
    defineStore(`astro_cart_${++uid}`, {
        state: () => ({ user: '', seen: new Date(0) }),
    });

afterEach(() => resetDefaultContainer());

describe('onRequest', () => {
    it('writes state set while rendering into the head, even across chunks', async () => {
        const useCart = defineCart();
        const ctx = context();
        const { text } = await handle(ctx, async () => {
            // Resolved without a container, as an island on the server would.
            useCart().user = 'ada';
            useCart().seen = new Date(5);
            return html([
                '<html><head><title>x</title></he',
                'ad><body>page</body></html>',
            ]);
        });

        expect(text).toMatch(
            /<\/title><script data-astro-rerun>.*<\/script><\/head><body>page/s,
        );
        const state = snapshotOf(text)![useCart.$id];
        expect(state.user).toBe('ada');
        expect(state.seen).toEqual(new Date(5));
        expect(getDefaultContainer().has(useCart.$id)).toBe(false);
    });

    it('keeps concurrent requests apart', async () => {
        const useCart = defineCart();
        const request = (user: string, delay: number) =>
            handle(context(`/?user=${user}`), async () => {
                await sleep(delay);
                useCart().user = user;
                await sleep(1);
                return html([`<head></head><body>${useCart().user}</body>`]);
            });
        const [ada, bob] = await Promise.all([
            request('ada', 20),
            request('bob', 5),
        ]);

        expect(ada.text).toContain('<body>ada</body>');
        expect(bob.text).toContain('<body>bob</body>');
        expect(snapshotOf(ada.text)![useCart.$id].user).toBe('ada');
        expect(snapshotOf(bob.text)![useCart.$id].user).toBe('bob');
    });

    it('calls an already-loaded client, as after a view transition', async () => {
        const { text } = await handle(context(), async () =>
            html(['<head></head>']),
        );
        const adopt = vi.fn();
        snapshotOf(text, adopt);
        expect(adopt).toHaveBeenCalledOnce();
    });

    it('cannot be broken out of by state', async () => {
        const useCart = defineCart();
        const hostile = '</script><script>alert(1)</script>';
        const { text } = await handle(context(), async () => {
            useCart().user = hostile;
            return html(['<head></head>']);
        });

        expect(text).not.toContain('<script>alert(1)');
        expect(snapshotOf(text)![useCart.$id].user).toBe(hostile);
    });

    it('exposes the container on locals and disposes it once sent', async () => {
        const ctx = context();
        const { response } = await handle(ctx, async () =>
            html(['<head></head>'], { 'content-length': '13' }),
        );

        expect(ctx.locals.quanta?.active).toBe(false);
        expect(response.headers.get('content-length')).toBeNull();
    });

    it('passes other responses through unchanged', async () => {
        const ctx = context('/api');
        const { response, text } = await handle(ctx, async () =>
            Response.json({ ok: true }, { status: 201 }),
        );

        expect(text).toBe('{"ok":true}');
        expect(response.status).toBe(201);
        expect(ctx.locals.quanta?.active).toBe(false);
    });

    it('leaves a page without a head as it is', async () => {
        const { text } = await handle(context(), async () =>
            html(['<p>fragment</p>']),
        );
        expect(text).toBe('<p>fragment</p>');
    });

    it('disposes the container of a response without a body', async () => {
        const ctx = context();
        const next = vi.fn(async () => new Response(null, { status: 204 }));
        await onRequest(ctx as never, next as never);
        expect(ctx.locals.quanta?.active).toBe(false);
    });
});
