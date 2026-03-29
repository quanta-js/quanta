/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { useDevToolsBridge } from '../hooks/useDevToolsBridge';

type BridgeSnapshot = ReturnType<typeof useDevToolsBridge>;

async function flushUpdates() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe('useDevToolsBridge', () => {
    const container = document.createElement('div');
    let snapshot: BridgeSnapshot | null = null;
    let emit: ((event: any) => void) | null = null;
    let unsubscribeSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        document.body.appendChild(container);
        snapshot = null;
        emit = null;
        unsubscribeSpy = vi.fn();

        (window as any).__QUANTA_DEVTOOLS__ = {
            subscribe: vi.fn((handler: (event: any) => void) => {
                emit = handler;
                return unsubscribeSpy;
            }),
        };
    });

    afterEach(() => {
        vi.useRealTimers();
        render(null, container);
        container.remove();
        delete (window as any).__QUANTA_DEVTOOLS__;
    });

    it('processes store and action events and caps action history', async () => {
        function Probe() {
            snapshot = useDevToolsBridge();
            return null;
        }

        await act(async () => {
            render(h(Probe, {}), container);
        });
        await flushUpdates();

        expect(emit).not.toBeNull();

        await act(async () => {
            emit?.({
                type: 'STORE_INIT',
                payload: { name: 'cart', store: { state: { count: 0 } } },
            });
        });
        await flushUpdates();

        expect(snapshot?.stores.cart).toBeDefined();

        await act(async () => {
            emit?.({
                type: 'STATE_CHANGE',
                payload: { storeName: 'cart' },
            });
            emit?.({
                type: 'STATE_CHANGE',
                payload: { storeName: 'missing' },
            });
        });
        await flushUpdates();

        for (let i = 0; i < 120; i++) {
            await act(async () => {
                emit?.({
                    type: 'ACTION_CALL',
                    payload: {
                        storeName: 'cart',
                        actionName: 'add',
                        args: [i],
                    },
                });
            });
        }
        await flushUpdates();

        expect(snapshot?.actions.length).toBe(100);
        expect(snapshot?.actions[0].actionName).toBe('add');
    });

    it('cleans up bridge subscription on unmount', async () => {
        function Probe() {
            snapshot = useDevToolsBridge();
            return null;
        }

        await act(async () => {
            render(h(Probe, {}), container);
        });
        await flushUpdates();

        await act(async () => {
            render(null, container);
        });

        expect(unsubscribeSpy).toHaveBeenCalledOnce();
        expect(snapshot).not.toBeNull();
    });

    it('retries bridge connection and cancels retry timer on unmount', async () => {
        vi.useFakeTimers();
        const subscribeSpy = vi.fn();
        delete (window as any).__QUANTA_DEVTOOLS__;

        function Probe() {
            snapshot = useDevToolsBridge();
            return null;
        }

        await act(async () => {
            render(h(Probe, {}), container);
        });

        vi.advanceTimersByTime(500);
        (window as any).__QUANTA_DEVTOOLS__ = { subscribe: subscribeSpy };
        vi.advanceTimersByTime(500);
        await act(async () => {});

        expect(subscribeSpy).toHaveBeenCalledTimes(1);

        await act(async () => {
            render(null, container);
        });
        vi.useRealTimers();
    });
});
