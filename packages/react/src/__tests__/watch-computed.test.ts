/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createStore } from '@quantajs/core';

let storeId = 0;
function uniqueName(prefix = 'watchcomp') {
    return `${prefix}_${++storeId}_${Date.now()}`;
}

describe('useWatch', () => {
    let useWatch: any;

    beforeEach(async () => {
        const mod = await import('../hooks/useWatch');
        useWatch = mod.useWatch;
    });

    it('should watch store value changes', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
        });

        const callback = vi.fn();
        renderHook(() => useWatch(store, (s: any) => s.count, callback));

        act(() => {
            store.count = 5;
        });

        expect(callback).toHaveBeenCalled();
    });

    it('should call with options (deep, immediate)', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ nested: { value: 1 } }),
        });

        const callback = vi.fn();
        renderHook(() =>
            useWatch(store, (s: any) => s.nested, callback, {
                deep: true,
                immediate: true,
            }),
        );

        // immediate: true should invoke callback on first run
        expect(callback).toHaveBeenCalled();
    });

    it('should cleanup on unmount', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
        });

        const callback = vi.fn();
        const { unmount } = renderHook(() =>
            useWatch(store, (s: any) => s.count, callback),
        );

        unmount();
        // After unmount, the watch should be cleaned up
    });
});

describe('useComputed', () => {
    let useComputed: any;

    beforeEach(async () => {
        const mod = await import('../hooks/useComputed');
        useComputed = mod.useComputed;
    });

    it('should compute a value from store state', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 3 }),
        });

        const { result } = renderHook(() =>
            useComputed(store, (s: any) => s.count * 2),
        );

        expect(result.current).toBe(6);
    });

    it('should compute from any store properties', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ a: 3, b: 7 }),
        });

        const { result } = renderHook(() =>
            useComputed(store, (s: any) => s.a + s.b),
        );

        expect(result.current).toBe(10);
    });
});
