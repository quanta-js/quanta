/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createStore, logger } from '@quantajs/core';

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

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should watch store value changes', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
        });

        const callback = vi.fn();
        renderHook(() => useWatch(store, (s: any) => s.count, callback));

        expect(callback).not.toHaveBeenCalled();

        act(() => {
            store.count = 5;
        });

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(5);
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
        const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});

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

        expect(logError).toHaveBeenCalledWith(
            'useWatch: Failed to execute watch callback: watch callback failed',
        );
    });

    it('should log and rethrow non-Error values thrown by the callback', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
        });
        const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});

        renderHook(() =>
            useWatch(
                store,
                (s: any) => s.count,
                () => {
                    throw 'callback string failure';
                },
            ),
        );

        expect(() => {
            act(() => {
                store.count = 1;
            });
        }).toThrow('callback string failure');

        expect(logError).toHaveBeenCalledWith(
            'useWatch: Failed to execute watch callback: callback string failure',
        );
    });

    it('should log and rethrow Error when the watch function throws during setup', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
        });
        const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => {
            renderHook(() =>
                useWatch(
                    store,
                    () => {
                        throw new Error('watch fn setup failed');
                    },
                    vi.fn(),
                ),
            );
        }).toThrow(/watch fn setup failed/);

        expect(logError).toHaveBeenCalledWith(
            'useWatch: Failed to execute watch function: watch fn setup failed',
        );
        expect(logError).toHaveBeenCalledWith(
            'useWatch: Failed to set up watcher: watch fn setup failed',
        );
    });

    it('should log and rethrow non-Error values when the watch function throws during setup', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
        });
        const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => {
            renderHook(() =>
                useWatch(
                    store,
                    () => {
                        throw 'watch fn string error';
                    },
                    vi.fn(),
                ),
            );
        }).toThrow('watch fn string error');

        expect(logError).toHaveBeenCalledWith(
            'useWatch: Failed to execute watch function: watch fn string error',
        );
        expect(logError).toHaveBeenCalledWith(
            'useWatch: Failed to set up watcher: watch fn string error',
        );
    });

    it('should log and rethrow when the watch function throws on a state update', () => {
        const name = uniqueName();
        const store = createStore(name, {
            state: () => ({ count: 0 }),
        });
        const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});

        renderHook(() =>
            useWatch(
                store,
                (s: any) => {
                    if (s.count > 0) {
                        throw new Error('watch fn update failed');
                    }
                    return s.count;
                },
                vi.fn(),
            ),
        );

        expect(() => {
            act(() => {
                store.count = 1;
            });
        }).toThrow(/watch fn update failed/);

        expect(logError).toHaveBeenCalledWith(
            'useWatch: Failed to execute watch function: watch fn update failed',
        );
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
