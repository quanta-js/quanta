/**
 * Error boundaries and edge cases.
 *
 * These assert **behaviour under failure** — what propagates, what is
 * contained, what state is left behind — rather than how many times the logger
 * was called. Diagnostics are now `__DEV__`-gated and deliberately emitted once
 * at the boundary instead of at every layer, so counting log calls would be
 * testing an implementation detail that is stripped from production builds.
 */
import { describe, it, expect, vi } from 'vitest';
import { createStore, getOrCreateStore } from '../core/create-store';
import { flattenStore } from '../utils/flattenStore';
import { Dependency } from '../core/dependency';
import {
    batchEffects,
    reactiveEffect,
    notifyDependency,
    effectScope,
} from '../core/effect';
import { reactive, computed, watch } from '../state';

let uid = 0;
const name = (prefix: string) => `cov_${prefix}_${++uid}_${Date.now()}`;

describe('error boundaries', () => {
    describe('flattenStore', () => {
        it('exposes actions, getters and state through one surface', () => {
            const store = flattenStore({
                state: { count: 1 },
                getters: { doubled: { value: 2 } },
                actions: { act: () => 'ran' },
                $reset: () => {},
                $destroy: () => {},
            } as never);

            const flat = store as unknown as {
                count: number;
                doubled: number;
                act: () => string;
            };
            expect(flat.count).toBe(1);
            expect(flat.doubled).toBe(2);
            expect(flat.act()).toBe('ran');
        });

        it('propagates an error thrown by the underlying state accessor', () => {
            const store = flattenStore({
                get state(): Record<string, unknown> {
                    throw new Error('state get error');
                },
                getters: {},
                actions: {},
                $reset: () => {},
                $destroy: () => {},
            } as never);

            expect(() => (store as unknown as { prop: unknown }).prop).toThrow(
                'state get error',
            );
        });

        it('refuses to assign over a getter and leaves state untouched', () => {
            const store = createStore(name('getterwrite'), {
                state: () => ({ items: [1, 2, 3] }),
                getters: { count: (s) => s.items.length },
            });
            const flat = store as unknown as { count: number };

            flat.count = 99; // ignored — getters are derived
            expect(flat.count).toBe(3);

            store.$destroy();
        });
    });

    describe('effect failures', () => {
        it('propagates a throw from the effect body on first run', () => {
            expect(() =>
                reactiveEffect(() => {
                    throw new Error('effect init fail');
                }),
            ).toThrow('effect init fail');
        });

        it('leaves a failed effect subscribed so it can recover', () => {
            const state = reactive({ ok: false });
            let attempts = 0;
            let succeeded = 0;

            expect(() =>
                reactiveEffect(() => {
                    attempts++;
                    if (!state.ok) throw new Error('not ready');
                    succeeded++;
                }),
            ).toThrow('not ready');

            // The dependency on `ok` was registered before the throw, so
            // flipping it re-runs the effect rather than stranding it.
            expect(() => {
                state.ok = true;
            }).not.toThrow();
            expect(attempts).toBe(2);
            expect(succeeded).toBe(1);
        });

        it('runs every subscriber even when an earlier one throws', () => {
            const dep = new Dependency();
            const failing = () => {
                throw new Error('bad subscriber');
            };
            const healthy = vi.fn();
            dep.depend(failing);
            dep.depend(healthy);

            const errors: unknown[] = [];
            notifyDependency(dep, errors);

            expect(healthy).toHaveBeenCalledOnce();
            expect(errors).toHaveLength(1);
        });

        it('detects an effect that triggers itself instead of overflowing', () => {
            const state = reactive({ n: 0 });
            expect(() =>
                reactiveEffect(() => {
                    state.n = state.n + 1; // reads and writes the same key
                }),
            ).toThrow(/[Cc]ircular/);
        });
    });

    describe('batchEffects', () => {
        it('propagates an error thrown by the batch body', () => {
            expect(() =>
                batchEffects(() => {
                    throw new Error('batch inner error');
                }),
            ).toThrow('batch inner error');
        });

        it('discards queued triggers when the batch aborts', () => {
            const state = reactive({ a: 0, b: 0 });
            let runs = 0;
            reactiveEffect(() => {
                void state.a;
                void state.b;
                runs++;
            });
            const baseline = runs;

            expect(() =>
                batchEffects(() => {
                    state.a = 1;
                    throw new Error('abort');
                }),
            ).toThrow('abort');

            // The write landed, but the effect was not run for an aborted batch.
            expect(state.a).toBe(1);
            expect(runs).toBe(baseline);
        });

        it('returns the callback result', () => {
            expect(batchEffects(() => 42)).toBe(42);
            expect(batchEffects(() => 'value')).toBe('value');
        });

        it('flushes only once for nested batches', () => {
            const state = reactive({ a: 0, b: 0 });
            let runs = 0;
            reactiveEffect(() => {
                void state.a;
                void state.b;
                runs++;
            });
            const baseline = runs;

            batchEffects(() => {
                state.a = 1;
                batchEffects(() => {
                    state.b = 2;
                });
            });

            expect(runs - baseline).toBe(1);
        });
    });

    describe('effectScope', () => {
        it('stops every effect created inside it', () => {
            const state = reactive({ n: 0 });
            let effectRuns = 0;
            let watchRuns = 0;

            const scope = effectScope();
            scope.run(() => {
                reactiveEffect(() => {
                    void state.n;
                    effectRuns++;
                });
                watch(
                    () => state.n,
                    () => watchRuns++,
                );
            });

            state.n = 1;
            expect(effectRuns).toBe(2);
            expect(watchRuns).toBe(1);

            scope.stop();
            state.n = 2;

            expect(effectRuns).toBe(2);
            expect(watchRuns).toBe(1);
        });

        it('is idempotent', () => {
            const scope = effectScope();
            scope.stop();
            expect(() => scope.stop()).not.toThrow();
            expect(scope.active).toBe(false);
        });
    });

    describe('createStore failure modes', () => {
        it('throws when options are missing', () => {
            expect(() =>
                createStore(name('nullopts'), null as never),
            ).toThrow();
        });

        it('propagates a throw from the state factory', () => {
            expect(() =>
                createStore(name('statefail'), {
                    state: () => {
                        throw new Error('state init error');
                    },
                }),
            ).toThrow('state init error');
        });

        it('does not leave a half-built store registered after a failure', () => {
            const storeName = name('halfbuilt');
            expect(() =>
                createStore(storeName, {
                    state: () => {
                        throw new Error('nope');
                    },
                }),
            ).toThrow();

            // The name must still be free.
            const recovered = createStore(storeName, {
                state: () => ({ ok: true }),
            });
            expect((recovered as unknown as { ok: boolean }).ok).toBe(true);
            recovered.$destroy();
        });

        it('getOrCreateStore returns the existing instance instead of throwing', () => {
            const storeName = name('getorcreate');
            const first = getOrCreateStore(storeName, {
                state: () => ({ n: 1 }),
            });
            (first as unknown as { n: number }).n = 5;

            const second = getOrCreateStore(storeName, {
                state: () => ({ n: 1 }),
            });

            expect(second).toBe(first);
            expect((second as unknown as { n: number }).n).toBe(5);

            first.$destroy();
        });
    });

    describe('computed failure modes', () => {
        it('rethrows a getter error and retries on the next read', () => {
            const state = reactive({ valid: false });
            let calls = 0;
            const derived = computed(() => {
                calls++;
                if (!state.valid) throw new Error('invalid');
                return 'ok';
            });

            expect(() => derived.value).toThrow('invalid');
            // A failed compute must not be cached as a successful one.
            expect(() => derived.value).toThrow('invalid');
            expect(calls).toBe(2);

            state.valid = true;
            expect(derived.value).toBe('ok');
        });

        it('stops recomputing once stopped', () => {
            const state = reactive({ n: 1 });
            let calls = 0;
            const derived = computed(() => {
                calls++;
                return state.n * 2;
            });

            expect(derived.value).toBe(2);
            derived.stop();
            state.n = 5;

            expect(calls).toBe(1);
            expect(() => derived.stop()).not.toThrow();
        });
    });
});
