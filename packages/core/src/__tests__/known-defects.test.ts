/**
 * KNOWN DEFECTS — executable specification of confirmed bugs in v2.0.0.
 *
 * Every test in this file is written as the CORRECT behaviour and marked
 * `it.fails(...)`, so:
 *
 *   - CI stays green while the defect exists (the failure is expected),
 *   - the moment somebody fixes the underlying bug the test goes RED,
 *     which is the signal to delete `.fails` and promote it to a normal test.
 *
 * Each case carries the finding ID from the v2.0.0 audit report
 * (see ANALYSIS-v2.md at the repo root).
 *
 * DO NOT "fix" a test here by weakening the assertion. The assertion is the
 * contract we intend to ship.
 */
import { describe, it, expect, vi } from 'vitest';
import * as PublicAPI from '../index';
import { reactive, createStore, batchEffects } from '../index';
import { reactiveEffect } from '../core/effect';
import { devtools } from '../devtools';

let uid = 0;
const name = (p: string) => `kd_${p}_${++uid}_${Date.now()}`;

describe('known defects — reactivity core', () => {
    /**
     * B-6 — Adding a NEW key does not invalidate ownKeys/Object.keys dependents.
     * `set` triggers only the specific prop; `deleteProperty` triggers 'keys'
     * but `set` never does. Anything that enumerates state (Object.keys,
     * for..in, spread, JSON.stringify) goes stale when a key is added — which
     * is exactly what normalised state (`byId[newId] = …`) does all day.
     */
    it.fails('B-6: adding a new key re-runs Object.keys() dependents', () => {
        const state = reactive<Record<string, number>>({ a: 1 });
        const seen: number[] = [];
        reactiveEffect(() => seen.push(Object.keys(state).length));

        expect(seen).toEqual([1]);
        state.b = 2;
        expect(seen).toEqual([1, 2]);
    });

    /**
     * B-3 — bubbleTrigger() calls dep.notify() directly, bypassing both the
     * batchDepth queue and each effect's scheduler. Batching therefore does
     * not apply to nested state at all.
     */
    it.fails('B-3: batchEffects() coalesces nested mutations', () => {
        const state = reactive({ nested: { n: 0 } });
        let runs = 0;
        reactiveEffect(() => {
            void state.nested.n;
            runs++;
        });

        const before = runs;
        batchEffects(() => {
            state.nested.n = 1;
            state.nested.n = 2;
            state.nested.n = 3;
        });
        expect(runs - before).toBe(1); // actual: 4
    });

    /**
     * B-9 — Array mutators batch their index writes but then fire
     * `trigger(obj, 'length')` OUTSIDE the batch, so one push() runs
     * dependent effects three times.
     */
    it.fails('B-9: a single push() runs dependent effects exactly once', () => {
        const state = reactive({ list: [1] });
        let runs = 0;
        reactiveEffect(() => {
            void state.list.length;
            runs++;
        });

        const before = runs;
        state.list.push(2);
        expect(runs - before).toBe(1); // actual: 3
    });

    /**
     * B-7 — parentMap entries are never pruned. A child that has been
     * replaced or deleted still bubbles into its former parent's dependency,
     * causing phantom invalidations; the parent is also kept strongly
     * reachable from the child, which retains memory.
     */
    it.fails(
        'B-7: a detached child no longer notifies its former parent',
        () => {
            const state = reactive<{ child: { v: number } }>({
                child: { v: 0 },
            });
            let runs = 0;
            reactiveEffect(() => {
                void state.child.v;
                runs++;
            });

            const detached = state.child;
            state.child = { v: 100 };
            const after = runs;

            detached.v = 999; // mutating an object no longer attached to the tree
            expect(runs - after).toBe(0); // actual: 1
        },
    );
});

describe('known defects — store', () => {
    /**
     * B-5 — createStore warns "getter will take priority on flat store", but
     * flattenStore checks `prop in target.state` FIRST, so state wins.
     * Documented behaviour and actual behaviour disagree.
     */
    it.fails('B-5: a getter shadowing state wins on the flat store', () => {
        const store = createStore(name('shadow'), {
            state: () => ({ count: 5 }),
            getters: { count: (s) => s.count * 1000 },
        });
        try {
            expect((store as unknown as { count: number }).count).toBe(5000);
        } finally {
            store.$destroy();
        }
    });

    /**
     * B-10 — $reset() assigns every key individually with no batching, so one
     * logical reset produces N separate subscriber notifications. It also
     * deletes keys while iterating the same object with for..in.
     */
    it.fails('B-10: $reset() notifies subscribers exactly once', () => {
        const store = createStore(name('reset'), {
            state: () => ({ a: 1, b: 2, c: 3, d: 4 }),
        });
        const s = store as unknown as Record<string, number>;
        s.a = 9;
        s.b = 9;
        s.c = 9;
        s.d = 9;

        let notifications = 0;
        store.subscribe(() => notifications++);
        store.$reset();
        try {
            expect(notifications).toBe(1);
        } finally {
            store.$destroy();
        }
    });

    /**
     * B-15 — The store registry is a module-global Map keyed by name, so a
     * store declared at module scope is a PROCESS-WIDE singleton. Under SSR,
     * one user's data is visible to the next request. There is no
     * per-request container primitive.
     */
    it.fails('B-15: stores can be scoped per request/isolate for SSR', () => {
        const storeName = name('ssr');
        const store = createStore(storeName, { state: () => ({ email: '' }) });
        const s = store as unknown as { email: string };

        s.email = 'alice@corp.com'; // "request 1"
        // "request 2" — a different user, same server process:
        try {
            expect(s.email).toBe('');
        } finally {
            store.$destroy();
        }
    });

    /**
     * B-16 — Re-creating a store with the same name throws. This makes HMR,
     * StrictMode double-mount and repeated test setup hostile; there is no
     * "get or create" affordance.
     */
    it.fails('B-16: re-declaring a store is idempotent (HMR-safe)', () => {
        const storeName = name('dup');
        const a = createStore(storeName, { state: () => ({ n: 0 }) });
        try {
            expect(() =>
                createStore(storeName, { state: () => ({ n: 0 }) }),
            ).not.toThrow();
        } finally {
            a.$destroy();
        }
    });

    /**
     * S-5 / DX — There is no way to await hydration. `$persist` exposes a
     * polling `isRehydrated()` only, and createStore returns before the
     * adapter read resolves, which is the root cause of SSR flash-of-wrong-
     * content. An enterprise app needs `await store.$hydrated`.
     */
    it.fails('DX: store exposes an awaitable hydration promise', () => {
        const store = createStore(name('hydrate'), { state: () => ({ n: 0 }) });
        try {
            expect(
                (store as unknown as { $hydrated?: Promise<void> }).$hydrated,
            ).toBeInstanceOf(Promise);
        } finally {
            store.$destroy();
        }
    });
});

describe('known defects — devtools integration', () => {
    /**
     * B-2 — THE devtools bug. `registerStore` keys stateMap by the reactive
     * PROXY (`store.state`), but the proxy traps call
     * `devtools.notifyStateChange(obj, …)` with the RAW target. The lookup
     * therefore never resolves a store name and NO STATE_CHANGE event is ever
     * emitted, for root or nested properties. The DevTools state inspector
     * has never live-updated in v2.0.0.
     *
     * The existing devtools tests pass because they construct mock stores by
     * hand and call `devtools.emit()` directly, never exercising this path.
     */
    it.fails('B-2: mutating store state emits STATE_CHANGE events', () => {
        const wasEnabled = devtools.enabled;
        devtools.enabled = true;

        const events: Array<{ path: string }> = [];
        const unsub = devtools.subscribe((e) => {
            if (e.type === 'STATE_CHANGE') events.push(e.payload);
        });

        const store = createStore(name('dt'), {
            state: () => ({ n: 0, deep: { x: 1 } }),
        });
        const s = store as unknown as { n: number; deep: { x: number } };

        s.n = 42;
        s.deep.x = 2;

        try {
            expect(events.map((e) => e.path)).toEqual(['n', 'deep.x']);
        } finally {
            unsub();
            store.$destroy();
            devtools.enabled = wasEnabled;
        }
    });

    /**
     * S-6 / B-? — devtools.emit() invokes listeners without a try/catch, and
     * notifyStateChange runs INSIDE the reactive `set` trap. A single badly
     * behaved devtools listener therefore breaks application state writes.
     */
    it.fails(
        'S-6: a throwing devtools listener cannot break state writes',
        () => {
            const wasEnabled = devtools.enabled;
            devtools.enabled = true;

            const store = createStore(name('dtthrow'), {
                state: () => ({ n: 0 }),
            });
            const unsub = devtools.subscribe(() => {
                throw new Error('third-party devtools listener blew up');
            });

            try {
                expect(() => {
                    (store as unknown as { n: number }).n = 1;
                }).not.toThrow();
            } finally {
                unsub();
                store.$destroy();
                devtools.enabled = wasEnabled;
            }
        },
    );
});

describe('known defects — security', () => {
    /**
     * S-2 — Prototype pollution through the persistence merge path.
     * createStore's persistence `setState` is a bare
     * `for (const k in newState) state[k] = newState[k]` over JSON.parse
     * output, with no __proto__ / constructor / prototype filtering. Anything
     * that can write the storage key (XSS, a hostile same-origin script, a
     * tampered cross-tab `storage` event) controls the prototype of the store
     * state object.
     */
    it.fails(
        'S-2: merging untrusted parsed JSON cannot poison the prototype',
        () => {
            const state = reactive<Record<string, unknown>>({ safe: 1 });
            const hostile = JSON.parse('{"__proto__":{"polluted":"yes"}}');

            // exactly what persistence/core.ts -> setState does today:
            for (const key in hostile) {
                (state as Record<string, unknown>)[key] = hostile[key];
            }

            expect(state.polluted).toBeUndefined(); // actual: 'yes'
            expect(Object.getPrototypeOf(state)).toBe(Object.prototype);
        },
    );
});

describe('known defects — public API surface', () => {
    /**
     * B-14 — `toRaw` was implemented in create-reactive.ts (and shipped in a
     * "feat: implement toRaw utility" commit) but is not re-exported from any
     * index, so it is unreachable for consumers. The same applies to the
     * escape hatches every non-trivial app eventually needs.
     */
    it.fails('B-14: escape hatches and core primitives are exported', () => {
        const expected = [
            'toRaw', // implemented but never exported
            'effect', // reactiveEffect is internal-only
            'untrack', // pauseTracking/resumeTracking are internal-only
            'readonly',
            'shallowReactive',
            'markRaw',
            'effectScope',
            'nextTick',
        ];
        const missing = expected.filter((k) => !(k in PublicAPI));
        expect(missing).toEqual([]);
    });

    /**
     * B-26 — batchEffects is typed as `EffectFunction` (() => void) and
     * discards the callback's return value, so it cannot wrap a function that
     * produces a result.
     */
    it.fails('B-26: batchEffects returns the callback result', () => {
        const result = (batchEffects as unknown as <T>(fn: () => T) => T)(
            () => 42,
        );
        expect(result).toBe(42);
    });

    /**
     * DX — Actions have no async lifecycle. Every consumer hand-rolls
     * isLoading/error/abort state for every async action.
     */
    it.fails('DX: async actions expose pending/error state', async () => {
        const store = createStore(name('async'), {
            state: () => ({ data: null as string | null }),
            actions: {
                async load(this: { data: string | null }) {
                    this.data = await Promise.resolve('x');
                },
            },
        });
        const s = store as unknown as {
            load: () => Promise<void>;
            $pending?: Record<string, boolean>;
        };
        const p = s.load();
        try {
            expect(s.$pending?.load).toBe(true);
            await p;
            expect(s.$pending?.load).toBe(false);
        } finally {
            store.$destroy();
        }
    });
});

describe('known defects — performance characteristics', () => {
    /**
     * P-2 / P-3 / B-13 — Every store carries one deep-watcher effect that
     * enumerates all top-level keys and then notifies EVERY subscriber on any
     * change. There is no per-key subscription, so subscriber cost is O(all
     * subscribers) per mutation regardless of what they actually read.
     */
    it.fails(
        'B-13: subscribers can subscribe to a slice, not the whole store',
        () => {
            const store = createStore(name('fanout'), {
                state: () => ({ a: 0, b: 0 }),
            });
            const s = store as unknown as { a: number; b: number };

            const bWatcher = vi.fn();
            // There is no path/selector-scoped subscribe API; this is the only
            // option, and it fires for unrelated keys.
            store.subscribe(bWatcher);

            s.a = 1; // only `a` changed — a `b` subscriber should not be woken
            try {
                expect(bWatcher).not.toHaveBeenCalled();
            } finally {
                store.$destroy();
            }
        },
    );
});
