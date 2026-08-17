import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    devtools,
    enableDevTools,
    disableDevTools,
    type DevToolsEvent,
} from '../devtools';
import { createStore } from '../index';

let uid = 0;
const name = (prefix: string) => `dt_${prefix}_${++uid}_${Date.now()}`;

/** Subscribe and collect events, returning the buffer and an unsubscribe. */
function record() {
    const events: DevToolsEvent[] = [];
    const unsubscribe = devtools.subscribe((event) => events.push(event));
    return {
        events,
        unsubscribe,
        of: <T extends DevToolsEvent['type']>(type: T) =>
            events.filter((e) => e.type === type) as Extract<
                DevToolsEvent,
                { type: T }
            >[],
    };
}

describe('devtools bridge', () => {
    beforeEach(() => enableDevTools());
    afterEach(() => disableDevTools());

    describe('opt-in behaviour', () => {
        it('is disabled until explicitly enabled', () => {
            disableDevTools();
            expect(devtools.enabled).toBe(false);
        });

        it('does not attach to window until enabled', () => {
            disableDevTools();
            expect(
                (globalThis as Record<string, unknown>).window,
            ).toBeUndefined();
            // In a DOM environment the handle must appear only after enable().
            // Asserted in the happy-dom suite; here we assert the flag only.
            enableDevTools();
            expect(devtools.enabled).toBe(true);
        });

        it('emits nothing while disabled', () => {
            const { events, unsubscribe } = record();
            disableDevTools();

            devtools.emit({
                type: 'STATE_CHANGE',
                payload: {
                    storeName: 'x',
                    path: 'y',
                    value: 1,
                    timestamp: Date.now(),
                },
            });

            expect(events).toHaveLength(0);
            unsubscribe();
        });
    });

    describe('store lifecycle', () => {
        it('replays STORE_INIT for stores registered before subscription', () => {
            const storeName = name('replay');
            const store = createStore(storeName, { state: () => ({ n: 0 }) });

            const { of, unsubscribe } = record();

            expect(
                of('STORE_INIT').some((e) => e.payload.name === storeName),
            ).toBe(true);

            unsubscribe();
            store.$destroy();
        });

        it('emits STORE_DISPOSE when a store is destroyed', () => {
            const storeName = name('dispose');
            const store = createStore(storeName, { state: () => ({ n: 0 }) });
            const { of, unsubscribe } = record();

            store.$destroy();

            expect(
                of('STORE_DISPOSE').some((e) => e.payload.name === storeName),
            ).toBe(true);
            unsubscribe();
        });
    });

    /**
     * The regression that mattered: `stateMap` used to be keyed by the reactive
     * proxy while the proxy traps reported mutations against the raw target, so
     * the store-name lookup never resolved and NO state change was ever emitted.
     *
     * These tests drive the real path — createStore, then mutate — rather than
     * calling `emit()` by hand, which is exactly why the original suite stayed
     * green while the feature was completely dead.
     */
    describe('state change reporting (end to end)', () => {
        it('reports a root-level mutation', () => {
            const storeName = name('root');
            const store = createStore(storeName, { state: () => ({ n: 0 }) });
            const { of, unsubscribe } = record();

            (store as unknown as { n: number }).n = 42;

            const change = of('STATE_CHANGE').find(
                (e) => e.payload.storeName === storeName,
            );
            expect(change?.payload.path).toBe('n');
            expect(change?.payload.value).toBe(42);

            unsubscribe();
            store.$destroy();
        });

        it('reports a nested mutation with a dotted path', () => {
            const storeName = name('nested');
            const store = createStore(storeName, {
                state: () => ({ user: { profile: { name: 'ada' } } }),
            });
            const flat = store as unknown as {
                user: { profile: { name: string } };
            };
            // Read first so the parent links are established.
            void flat.user.profile.name;

            const { of, unsubscribe } = record();
            flat.user.profile.name = 'grace';

            const change = of('STATE_CHANGE').find(
                (e) => e.payload.storeName === storeName,
            );
            expect(change?.payload.path).toBe('user.profile.name');
            expect(change?.payload.value).toBe('grace');

            unsubscribe();
            store.$destroy();
        });

        it('reports array and collection mutations', () => {
            const storeName = name('coll');
            const store = createStore(storeName, {
                state: () => ({ tags: ['a'], byId: new Map<string, number>() }),
            });
            const flat = store as unknown as {
                tags: string[];
                byId: Map<string, number>;
            };
            void flat.tags.length;

            const { of, unsubscribe } = record();
            flat.tags.push('b');
            flat.byId.set('k', 1);

            expect(
                of('STATE_CHANGE').filter(
                    (e) => e.payload.storeName === storeName,
                ).length,
            ).toBeGreaterThan(0);

            unsubscribe();
            store.$destroy();
        });

        it('ignores objects that belong to no registered store', () => {
            const { of, unsubscribe } = record();
            devtools.notifyStateChange({ orphan: true }, 'orphan', 1);
            expect(of('STATE_CHANGE')).toHaveLength(0);
            unsubscribe();
        });
    });

    describe('action reporting', () => {
        it('emits ACTION_CALL with the arguments', () => {
            const storeName = name('action');
            const store = createStore(storeName, {
                state: () => ({ n: 0 }),
                actions: {
                    add(this: { n: number }, by: number) {
                        this.n += by;
                    },
                },
            });
            const { of, unsubscribe } = record();

            (store as unknown as { add: (n: number) => void }).add(5);

            const call = of('ACTION_CALL').find(
                (e) => e.payload.storeName === storeName,
            );
            expect(call?.payload.actionName).toBe('add');
            expect(call?.payload.args).toEqual([5]);

            unsubscribe();
            store.$destroy();
        });
    });

    describe('redaction', () => {
        it('masks configured state paths', () => {
            disableDevTools();
            enableDevTools({ redact: ['token'] });

            const storeName = name('redact');
            const store = createStore(storeName, {
                state: () => ({ token: '', safe: '' }),
            });
            const { of, unsubscribe } = record();

            const flat = store as unknown as { token: string; safe: string };
            flat.token = 'super-secret';
            flat.safe = 'visible';

            const changes = of('STATE_CHANGE').filter(
                (e) => e.payload.storeName === storeName,
            );
            expect(
                changes.find((e) => e.payload.path === 'token')?.payload.value,
            ).toBe('[redacted]');
            expect(
                changes.find((e) => e.payload.path === 'safe')?.payload.value,
            ).toBe('visible');

            unsubscribe();
            store.$destroy();
        });

        it('masks matching keys inside action arguments', () => {
            disableDevTools();
            enableDevTools({ redact: ['password'] });

            const storeName = name('redactargs');
            const store = createStore(storeName, {
                state: () => ({ n: 0 }),
                actions: {
                    login(this: { n: number }, _creds: unknown) {
                        this.n++;
                    },
                },
            });
            const { of, unsubscribe } = record();

            (store as unknown as { login: (c: unknown) => void }).login({
                user: 'ada',
                password: 'hunter2',
            });

            const call = of('ACTION_CALL').find(
                (e) => e.payload.storeName === storeName,
            );
            expect(call?.payload.args[0]).toEqual({
                user: 'ada',
                password: '[redacted]',
            });

            unsubscribe();
            store.$destroy();
        });
    });

    /**
     * `notifyStateChange` runs inside the reactive `set` trap, so an exception
     * escaping a listener would break the application's ability to write state.
     */
    describe('listener isolation', () => {
        it('survives a listener that throws on every event', () => {
            const storeName = name('hostile');
            const store = createStore(storeName, { state: () => ({ n: 0 }) });

            const unsubscribe = devtools.subscribe(() => {
                throw new Error('hostile listener');
            });
            const healthy = vi.fn();
            const unsubscribeHealthy = devtools.subscribe(healthy);

            expect(() => {
                (store as unknown as { n: number }).n = 1;
            }).not.toThrow();
            expect((store as unknown as { n: number }).n).toBe(1);
            // The healthy listener still received the event.
            expect(healthy).toHaveBeenCalled();

            unsubscribe();
            unsubscribeHealthy();
            store.$destroy();
        });

        it('survives a listener that throws during init replay', () => {
            const storeName = name('replaythrow');
            const store = createStore(storeName, { state: () => ({ n: 0 }) });

            expect(() =>
                devtools.subscribe(() => {
                    throw new Error('replay boom');
                }),
            ).not.toThrow();

            store.$destroy();
        });
    });

    describe('unsubscribe', () => {
        it('stops delivering after unsubscribe', () => {
            const listener = vi.fn();
            const unsubscribe = devtools.subscribe(listener);
            listener.mockClear();
            unsubscribe();

            devtools.emit({
                type: 'STATE_CHANGE',
                payload: {
                    storeName: 'x',
                    path: 'y',
                    value: 1,
                    timestamp: Date.now(),
                },
            });

            expect(listener).not.toHaveBeenCalled();
        });
    });
});
