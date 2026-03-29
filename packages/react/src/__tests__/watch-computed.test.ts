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
        act(() => {
            store.count = 10;
        });
        expect(callback).not.toHaveBeenCalled();
    });

    it('should surface callback errors from useWatch', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
        });

        renderHook(() =>
            useWatch(
                store,
                (s: any) => s.count,
                () => {
                    throw new Error('watch callback failed');
                },
            ),
        );

        expect(() => {
            act(() => {
                store.count = 1;
            });
        }).toThrow(/watch callback failed/);
    });

    it('should reconfigure when options change', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ nested: { value: 1 } }),
        });

        const callback = vi.fn();
        const { rerender } = renderHook(
            ({ deep, immediate }: { deep?: boolean; immediate?: boolean }) =>
                useWatch(store, (s: any) => s.nested, callback, {
                    deep,
                    immediate,
                }),
            {
                initialProps: { deep: false, immediate: false },
            },
        );

        act(() => {
            store.nested.value = 2;
        });
        expect(callback).not.toHaveBeenCalled();

        rerender({ deep: true, immediate: false });
        const callsBeforeDeepMutation = callback.mock.calls.length;
        act(() => {
            store.nested.value = 3;
        });
        expect(callback.mock.calls.length).toBeGreaterThan(
            callsBeforeDeepMutation,
        );
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

    it('should surface compute errors', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: -1 }),
        });

        expect(() => {
            renderHook(() =>
                useComputed(store, (s: any) => {
                    if (s.count < 0) {
                        throw new Error('invalid count');
                    }
                    return s.count;
                }),
            );
        }).toThrow(/invalid count/);
    });
});
