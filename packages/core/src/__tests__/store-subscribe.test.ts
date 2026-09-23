import { describe, it, expect, vi, afterEach } from 'vitest';
import { createContainer } from '../core/container';
import { defineStore } from '../core/define-store';
import type { PersistenceAdapter } from '../type/persistence-types';
import { logger } from '../services/logger-service';

afterEach(() => {
    vi.restoreAllMocks();
});

let uid = 0;
const counter = () =>
    defineStore(`sub_${++uid}`, {
        state: () => ({ count: 0, user: { name: 'ada' } }),
        actions: {
            increment() {
                this.count++;
            },
        },
    });

describe('store.subscribe()', () => {
    it('passes the state on every kind of change', () => {
        const store = counter()(createContainer());
        const received: unknown[] = [];
        store.subscribe((state) => received.push(state));

        store.count = 1;
        store.user.name = 'grace';
        store.$patch({ count: 2 });
        store.increment();

        expect(received).toHaveLength(4);
        for (const state of received) expect(state).toBe(store.state);
    });

    it('passes the state after hydrating from storage', async () => {
        const adapter: PersistenceAdapter = {
            key: 'k',
            read: () =>
                JSON.stringify({
                    data: { count: 5 },
                    version: 1,
                    timestamp: 0,
                }),
            write: () => {},
            remove: () => {},
        };
        vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const useStore = defineStore(`sub_${++uid}`, {
            state: () => ({ count: 0 }),
            persist: { adapter },
        });
        const store = useStore(createContainer());
        const received: unknown[] = [];
        store.subscribe((state) => received.push(state));

        await store.$hydrated;

        expect(store.count).toBe(5);
        expect(received.length).toBeGreaterThan(0);
        for (const state of received) expect(state).toBe(store.state);
    });

    it('stops calling a subscriber after unsubscribe', () => {
        const store = counter()(createContainer());
        const callback = vi.fn();
        const unsubscribe = store.subscribe(callback);

        store.count = 1;
        unsubscribe();
        store.count = 2;

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('runs every subscriber, then surfaces the first error', () => {
        const store = counter()(createContainer());
        const after = vi.fn();
        store.subscribe(() => {
            throw new Error('boom');
        });
        store.subscribe(after);

        expect(() => {
            store.count = 1;
        }).toThrow('boom');
        expect(after).toHaveBeenCalledTimes(1);
        expect(store.count).toBe(1);
    });

    it('surfaces subscriber errors from an action', () => {
        const store = counter()(createContainer());
        store.subscribe(() => {
            throw new Error('boom');
        });

        expect(() => store.increment()).toThrow('boom');
        expect(store.count).toBe(1);
    });
});
