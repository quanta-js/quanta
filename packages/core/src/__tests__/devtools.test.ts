import { describe, it, expect, vi } from 'vitest';
import { devtools } from '../devtools';

describe('DevToolsBridge', () => {
    it('should emit events to subscribers', () => {
        const listener = vi.fn();
        const unsub = devtools.subscribe(listener);

        // Clear init replay events
        listener.mockClear();

        devtools.emit({
            type: 'STATE_CHANGE',
            payload: { storeName: 'test', path: 'count', value: 42 },
        });

        expect(listener).toHaveBeenCalledWith({
            type: 'STATE_CHANGE',
            payload: { storeName: 'test', path: 'count', value: 42 },
        });

        unsub();
    });

    it('should support unsubscribe', () => {
        const listener = vi.fn();
        const unsub = devtools.subscribe(listener);
        listener.mockClear();

        unsub();

        devtools.emit({
            type: 'STATE_CHANGE',
            payload: { storeName: 'test', path: 'x', value: 1 },
        });

        expect(listener).not.toHaveBeenCalled();
    });

    it('should disable/enable event emission', () => {
        const listener = vi.fn();
        const unsub = devtools.subscribe(listener);
        listener.mockClear();

        const wasEnabled = devtools.enabled;
        devtools.enabled = false;

        devtools.emit({
            type: 'STATE_CHANGE',
            payload: { storeName: 'test', path: 'x', value: 1 },
        });

        expect(listener).not.toHaveBeenCalled();

        devtools.enabled = wasEnabled;
        unsub();
    });

    it('should register stores and replay init events', () => {
        const storeName = `devtools_test_${Date.now()}`;
        const mockStore = { state: { count: 0 } };

        devtools.registerStore(storeName, mockStore);

        const listener = vi.fn();
        const unsub = devtools.subscribe(listener);

        // Should have received replay of all registered stores
        const initEvents = listener.mock.calls.filter(
            (call: any) => call[0].type === 'STORE_INIT',
        );
        expect(initEvents.length).toBeGreaterThan(0);

        unsub();
    });

    it('should notify state changes with path resolution', () => {
        const storeName = `devtools_path_${Date.now()}`;
        const mockState = { nested: { value: 1 } };
        const mockStore = { state: mockState };

        devtools.registerStore(storeName, mockStore);

        const listener = vi.fn();
        const unsub = devtools.subscribe(listener);
        listener.mockClear();

        devtools.notifyStateChange(mockState, 'count', 42);

        const stateEvents = listener.mock.calls.filter(
            (call: any) => call[0].type === 'STATE_CHANGE',
        );
        expect(stateEvents.length).toBeGreaterThan(0);

        unsub();
    });

    it('should notify action calls', () => {
        const listener = vi.fn();
        const unsub = devtools.subscribe(listener);
        listener.mockClear();

        devtools.notifyActionCall('myStore', 'increment', [1]);

        expect(listener).toHaveBeenCalledWith({
            type: 'ACTION_CALL',
            payload: {
                storeName: 'myStore',
                actionName: 'increment',
                args: [1],
            },
        });

        unsub();
    });
});
