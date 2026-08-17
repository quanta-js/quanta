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

    it('should stay stable under rapid updates and selector changes', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0, label: 'a' }),
        });

        const { result, rerender } = renderHook(
            ({ mode }: { mode: 'count' | 'label' }) =>
                useQuantaSelector(store, (s: any) =>
                    mode === 'count' ? s.count : s.label,
                ),
            {
                initialProps: { mode: 'count' as 'count' | 'label' },
            },
        );

        act(() => {
            for (let i = 1; i <= 20; i++) {
                store.count = i;
            }
            store.label = 'latest-label';
        });

        expect(result.current).toBe(20);

        rerender({ mode: 'label' });
        expect(result.current).toBe('latest-label');

        act(() => {
            store.label = 'next-label';
            store.count = 21;
        });

        expect(result.current).toBe('next-label');
    });

    it('should throw for store without subscribe', () => {
        const fakeStore = { state: {} } as any;

        expect(() => {
            renderHook(() => useQuantaStore(fakeStore));
        }).toThrow(/subscribe/);
    });
});

describe('definition-based hooks', () => {
    let mod: any;
    let core: any;
    let provider: any;

    beforeEach(async () => {
        mod = await import('../hooks/useStore');
        core = await import('@quantajs/core');
        provider = await import('../components/QuantaProvider');
    });

    const makeDefinition = () =>
        core.defineStore(uniqueName(), {
            state: () => ({ count: 0, label: 'a' }),
            getters: { doubled: (s: any) => s.count * 2 },
            actions: {
                bump(this: any) {
                    this.count++;
                },
            },
        });

    it('resolves a definition against the ambient container', () => {
        const definition = makeDefinition();
        const { result } = renderHook(() => mod.useQuanta(definition));

        expect(result.current.count).toBe(0);
        expect(result.current.doubled).toBe(0);

        act(() => result.current.bump());
        expect(result.current.count).toBe(1);
        expect(result.current.doubled).toBe(2);
    });

    it('resolves against the provider container when there is one', () => {
        const definition = makeDefinition();
        const container = core.createContainer('test');
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                provider.QuantaProvider,
                { container },
                children,
            );

        const { result } = renderHook(() => mod.useQuanta(definition), {
            wrapper,
        });

        act(() => result.current.bump());

        // The instance lives in the supplied container, not the ambient one.
        expect(container.get(definition.$id).count).toBe(1);
        container.dispose();
    });

    it('useQuantaValue subscribes to only the selected slice', () => {
        const definition = makeDefinition();
        let renders = 0;
        const { result } = renderHook(() => {
            const value = mod.useQuantaValue(definition, (s: any) => s.count);
            renders++;
            return value;
        });

        const baseline = renders;
        const store = definition();

        act(() => {
            store.label = 'changed';
        });
        expect(renders).toBe(baseline);

        act(() => {
            store.bump();
        });
        expect(result.current).toBe(1);
    });

    it('useQuantaActions does not re-render on state changes', () => {
        const definition = makeDefinition();
        let renders = 0;
        const { result } = renderHook(() => {
            renders++;
            return mod.useQuantaActions(definition);
        });

        const baseline = renders;
        act(() => result.current.bump());

        expect(renders).toBe(baseline);
        expect(definition().count).toBe(1);
    });
});

describe('useLocalStore', () => {
    let useLocalStore: any;
    let core: any;

    beforeEach(async () => {
        useLocalStore = (await import('../hooks/useCreateStore')).useLocalStore;
        core = await import('@quantajs/core');
    });

    const definition = () =>
        core.defineStore(uniqueName(), {
            state: () => ({ count: 0 }),
        });

    it('creates a store scoped to the component', () => {
        const def = definition();
        const { result } = renderHook(() => useLocalStore(def));
        expect(result.current.count).toBe(0);
    });

    it('keeps the same instance across re-renders', () => {
        const def = definition();
        const { result, rerender } = renderHook(() => useLocalStore(def));
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });

    it('gives each mount its own isolated instance', () => {
        const def = definition();
        const a = renderHook(() => useLocalStore(def));
        const b = renderHook(() => useLocalStore(def));

        act(() => {
            a.result.current.count = 5;
        });

        // Separate containers, so the two mounts do not share state.
        expect(b.result.current.count).toBe(0);
        a.unmount();
        b.unmount();
    });

    it('disposes its container on unmount', () => {
        const def = definition();
        const { result, unmount } = renderHook(() => useLocalStore(def));
        const store = result.current;
        unmount();

        // The store is destroyed, so its subscribers are gone.
        let notified = 0;
        store.subscribe(() => notified++);
        store.count = 99;
        expect(notified).toBe(0);
    });

    it('does not leak into the ambient container', () => {
        const def = definition();
        const { unmount } = renderHook(() => useLocalStore(def));
        expect(core.hasStore(def.$id)).toBe(false);
        unmount();
    });
});
