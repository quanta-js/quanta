import { AsyncLocalStorage } from 'node:async_hooks';
import type { MiddlewareHandler } from 'astro';
import {
    createContainer,
    setDefaultContainerResolver,
    type StoreContainer,
} from '@quantajs/core';
import { uneval } from 'devalue';

declare global {
    namespace App {
        interface Locals {
            /** This request's store container. */
            quanta: StoreContainer;
        }
    }
}

const requests = new AsyncLocalStorage<StoreContainer>();

// Code rendering a request, including React, Vue and Svelte islands rendered
// on the server, resolves stores against that request's container without
// passing it. Outside a request the usual default container applies.
setDefaultContainerResolver(() => requests.getStore());

const HEAD_END = '</head>';

/**
 * The script that hands the request's state to the islands in the browser.
 * On a first load the client adopts it before hydrating any island; after a
 * view transition the client is already loaded, so the script calls it.
 */
function snapshotScript(container: StoreContainer): string {
    // `uneval` keeps Dates, Maps and Sets, and escapes `<`, so state cannot
    // close the script element.
    return `<script data-astro-rerun>window.__QUANTA__=${uneval(container.dehydrate())};window.__QUANTA_ADOPT__&&window.__QUANTA_ADOPT__()</script>`;
}

/**
 * Pass the page through, adding the snapshot just before `</head>`. By then
 * the page's frontmatter has run, which is where server state is loaded. The
 * container is disposed once the page has been sent.
 */
function injectSnapshot(
    body: ReadableStream<Uint8Array>,
    container: StoreContainer,
): ReadableStream<Uint8Array> {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let pending = '';
    let injected = false;

    return body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                if (injected) {
                    controller.enqueue(chunk);
                    return;
                }
                pending += decoder.decode(chunk, { stream: true });
                const at = pending.indexOf(HEAD_END);
                if (at !== -1) {
                    injected = true;
                    controller.enqueue(
                        encoder.encode(
                            pending.slice(0, at) +
                                snapshotScript(container) +
                                pending.slice(at),
                        ),
                    );
                    pending = '';
                    return;
                }
                // Keep just enough to find a tag split across two chunks.
                const keep = pending.length - (HEAD_END.length - 1);
                if (keep > 0) {
                    controller.enqueue(encoder.encode(pending.slice(0, keep)));
                    pending = pending.slice(keep);
                }
            },
            flush(controller) {
                pending += decoder.decode();
                if (pending) controller.enqueue(encoder.encode(pending));
                container.dispose();
            },
        }),
    );
}

/** Pass a body through unchanged, disposing the container once it is sent. */
function disposeAfter(
    body: ReadableStream<Uint8Array>,
    container: StoreContainer,
): ReadableStream<Uint8Array> {
    return body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            flush() {
                container.dispose();
            },
        }),
    );
}

/**
 * Give each request its own store container, available as
 * `Astro.locals.quanta` and as the default container while the request
 * renders. HTML responses carry the container's state to the browser, where
 * `@quantajs/astro/client` hydrates the islands from it.
 */
export const onRequest: MiddlewareHandler = (context, next) => {
    const container = createContainer(`astro:${context.url.pathname}`);
    context.locals.quanta = container;

    return requests.run(container, async () => {
        const response = await next();
        if (response.body === null) {
            container.dispose();
            return response;
        }

        const isHtml = (response.headers.get('content-type') ?? '').includes(
            'text/html',
        );
        const body = isHtml
            ? injectSnapshot(response.body, container)
            : disposeAfter(response.body, container);
        const headers = new Headers(response.headers);
        // The snapshot changes the length.
        if (isHtml) headers.delete('content-length');
        return new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    });
};
