/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { createStore } from '@quantajs/core';

// We test the hooks indirectly via the store integration since
// the hooks rely heavily on React's useSyncExternalStore

let storeId = 0;
function uniqueName(prefix = 'react') {
    return `${prefix}_${++storeId}_${Date.now()}`;
}

describe('useQuantaStore', () => {
    // Dynamic import to ensure happy-dom is available
    let useQuantaStore: any;
    let useQuantaSelector: any;

    beforeEach(async () => {
        const mod = await import('../hooks/useQuantaStore');
        useQuantaStore = mod.useQuantaStore;
        useQuantaSelector = mod.useQuantaSelector;
    });

    it('should return the full store without selector', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
        });

        const { result } = renderHook(() => useQuantaStore(store));
        expect(result.current.count).toBe(0);
    });

    it('should return selected value with selector', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 5, name: 'test' }),
        });

        const { result } = renderHook(() =>
            useQuantaSelector(store, (s: any) => s.count),
        );
        expect(result.current).toBe(5);
    });

    it('should re-render on state change (no selector)', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
            actions: {
                increment(this: any) {
                    this.count++;
                },
            },
        });

        const { result } = renderHook(() => useQuantaStore(store));

        act(() => {
            store.increment();
        });

        expect(result.current.count).toBe(1);
    });

    it('should re-render on selected value change', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0, unrelated: 'x' }),
        });

        const { result } = renderHook(() =>
            useQuantaSelector(store, (s: any) => s.count),
        );

        act(() => {
            store.count = 42;
        });

        expect(result.current).toBe(42);
    });

    it('should throw for store without subscribe', () => {
        const fakeStore = { state: {} } as any;

        expect(() => {
            renderHook(() => useQuantaStore(fakeStore));
        }).toThrow(/subscribe/);
    });
});

describe('useStore (context-based)', () => {
    let useStore: any;
    let QuantaProvider: any;

    beforeEach(async () => {
        const storeMod = await import('../hooks/useStore');
        useStore = storeMod.useStore;
        const providerMod = await import('../components/QuantaProvider');
        QuantaProvider = providerMod.QuantaProvider;
    });

    it('should access store from context', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ value: 'hello' }),
        });

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QuantaProvider,
                { stores: { [name]: store } },
                children,
            );

        const { result } = renderHook(() => useStore(name), { wrapper });
        expect(result.current.value).toBe('hello');
    });

    it('should throw for missing store in context', () => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                QuantaProvider as any,
                { stores: {} },
                children,
            );

        expect(() => {
            renderHook(() => useStore('nonexistent'), { wrapper });
        }).toThrow(/does not exist/);
    });
});

describe('useCreateStore', () => {
    let useCreateStore: any;

    beforeEach(async () => {
        const mod = await import('../hooks/useCreateStore');
        useCreateStore = mod.useCreateStore;
    });

    it('should create a store on first render', () => {
        const name = uniqueName();
        const { result } = renderHook(() =>
            useCreateStore(name, () => ({ count: 0 })),
        );

        expect(result.current.count).toBe(0);
    });

    it('should not recreate store on subsequent renders', () => {
        const name = uniqueName();
        const { result, rerender } = renderHook(() =>
            useCreateStore(name, () => ({ count: 0 })),
        );

        const firstRef = result.current;
        rerender();
        expect(result.current).toBe(firstRef);
    });

    it('should destroy store on unmount', () => {
        const name = uniqueName();
        const { result: _result, unmount } = renderHook(() =>
            useCreateStore(name, () => ({ count: 0 })),
        );

        unmount();

        // After unmount, the store should be destroyed from registry
        // Attempting to create the same name should now succeed
        const newStore = createStore(name, {
            state: () => ({ count: 99 }),
        });
        expect(newStore.count).toBe(99);
    });
});
