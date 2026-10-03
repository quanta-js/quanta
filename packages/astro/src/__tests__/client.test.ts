/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

let resetContainer: (() => void) | undefined;

async function loadClient(
    snapshot?: Record<string, Record<string, unknown>>,
) {
    vi.resetModules();

    if (snapshot !== undefined) {
        window.__QUANTA__ = snapshot;
    }

    const core = await import('@quantajs/core');
    resetContainer = core.resetDefaultContainer;
    await import('../client');

    return core;
}

afterEach(() => {
    resetContainer?.();
    resetContainer = undefined;
    delete window.__QUANTA__;
    delete window.__QUANTA_ADOPT__;
    vi.resetModules();
});

describe('client', () => {
    it('does nothing when the page has no snapshot', async () => {
        const { defineStore } = await loadClient();
        const useCounter = defineStore('astro_client_counter', {
            state: () => ({ count: 0 }),
        });

        expect(useCounter().count).toBe(0);
        expect(window.__QUANTA__).toBeUndefined();
    });

    it('seeds the default container from the page, before islands resolve stores', async () => {
        const { defineStore } = await loadClient({
            astro_client_counter: { count: 5 },
        });
        const useCounter = defineStore('astro_client_counter', {
            state: () => ({ count: 0 }),
        });

        expect(useCounter().count).toBe(5);
        expect(window.__QUANTA__).toBeUndefined();
    });

    it('lets later page snapshot scripts adopt state more than once', async () => {
        const { defineStore } = await loadClient();
        const useCounter = defineStore('astro_client_counter', {
            state: () => ({ count: 0 }),
        });

        window.__QUANTA__ = { astro_client_counter: { count: 9 } };
        window.__QUANTA_ADOPT__?.();

        expect(useCounter().count).toBe(9);
        expect(window.__QUANTA__).toBeUndefined();

        window.__QUANTA__ = { astro_client_counter: { count: 12 } };
        window.__QUANTA_ADOPT__?.();

        expect(useCounter().count).toBe(12);
        expect(window.__QUANTA__).toBeUndefined();
    });
});
