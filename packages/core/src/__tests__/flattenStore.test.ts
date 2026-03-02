import { describe, it, expect, vi } from 'vitest';
import { flattenStore } from '../utils/flattenStore';
import computed from '../state/computed';
import { createReactive } from '../core/create-reactive';

function makeStore(
    state: Record<string, any>,
    getters: Record<string, any> = {},
    actions: Record<string, any> = {},
) {
    const reactiveState = createReactive(state);
    return {
        state: reactiveState,
        getters: getters,
        actions: actions,
        subscribe: vi.fn(() => vi.fn()),
        notifyAll: vi.fn(),
        $reset: vi.fn(),
        $destroy: vi.fn(),
    };
}

describe('flattenStore', () => {
    it('should expose state properties directly', () => {
        const store = makeStore({ count: 42, name: 'test' });
        const flat = flattenStore(store);

        expect(flat.count).toBe(42);
        expect(flat.name).toBe('test');
    });

    it('should allow setting state properties via flat store', () => {
        const store = makeStore({ count: 0 });
        const flat = flattenStore(store);

        flat.count = 99;
        expect(flat.count).toBe(99);
        expect(store.state.count).toBe(99);
    });

    it('should expose getter .value from computed objects', () => {
        const state = createReactive({ count: 5 });
        const store = {
            state,
            getters: {
                doubled: computed(() => state.count * 2),
            },
            actions: {},
            subscribe: vi.fn(() => vi.fn()),
            notifyAll: vi.fn(),
            $reset: vi.fn(),
            $destroy: vi.fn(),
        };
        const flat = flattenStore(store);

        expect(flat.doubled).toBe(10);
    });

    it('should expose actions as functions', () => {
        const action = vi.fn();
        const store = makeStore({ count: 0 }, {}, { increment: action });
        const flat = flattenStore(store);

        expect(typeof flat.increment).toBe('function');
        flat.increment();
        expect(action).toHaveBeenCalled();
    });

    it('should fallback to store properties for meta keys', () => {
        const store = makeStore({ count: 0 });
        const flat = flattenStore(store);

        expect(typeof flat.$reset).toBe('function');
        expect(typeof flat.$destroy).toBe('function');
    });

    it('should prioritize state over getters over actions', () => {
        // State should be checked first
        const store = makeStore({ x: 'from-state' });
        const flat = flattenStore(store);
        expect(flat.x).toBe('from-state');
    });
});
