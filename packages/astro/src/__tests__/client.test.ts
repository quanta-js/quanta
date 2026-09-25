/**
 * @vitest-environment happy-dom
 *
 * The client runs once, when imported, like the script Astro loads before
 * hydration; these tests follow a first page load, then a later navigation.
 */
import { describe, it, expect } from 'vitest';
import { defineStore } from '@quantajs/core';

const useCounter = defineStore('astro_client_counter', {
    state: () => ({ count: 0 }),
});

describe('client', () => {
    it('seeds the default container from the page, before islands resolve stores', async () => {
        window.__QUANTA__ = { astro_client_counter: { count: 5 } };

        await import('../client');

        expect(useCounter().count).toBe(5);
        expect(window.__QUANTA__).toBeUndefined();
    });

    it('lets a later page’s snapshot script adopt its state', () => {
        // What the snapshot script does after a view transition, when the
        // client is already loaded.
        window.__QUANTA__ = { astro_client_counter: { count: 9 } };
        window.__QUANTA_ADOPT__?.();

        expect(useCounter().count).toBe(9);
        expect(window.__QUANTA__).toBeUndefined();
    });
});
