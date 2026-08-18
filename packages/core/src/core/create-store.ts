import type {
    ActionsTree,
    ActionState,
    GettersTree,
    StateTree,
    Store,
    StoreDefinitionOptions,
    StoreSubscriber,
} from '../type/store-types';
import { reactive, computed } from '../state';
import type { ComputedRef } from '../state/computed';
import { flattenStore } from '../utils/flattenStore';
import { Dependency } from './dependency';
import {
    reactiveEffect,
    pauseTracking,
    resumeTracking,
    batchEffects,
    notifyDependency,
    effectScope,
    track,
    type EffectScope,
} from './effect';
import { createPersistenceManager } from '../persistence';
import type {
    PersistenceManager,
    PersistenceConfig,
} from '../type/persistence-types';
import { logger } from '../services/logger-service';
import { __DEV__ } from '../utils/env';
import { devtools } from '../devtools';
import { isSafeKey } from '../utils/sanitize';
import { toRaw, ANY_CHANGE } from './create-reactive';

/** Hooks the owning container installs on a store. */
export interface StoreHost {
    /** Called once when the store is destroyed, so the container can forget it. */
    onDestroy: () => void;
}

/**
 * Build a store instance.
 *
 * Internal: stores are always created through a {@link StoreContainer}, which
 * owns the name → instance mapping. Keeping instantiation free of any registry
 * of its own is what makes per-request isolation possible.
 */
export function instantiateStore<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(
    name: string,
    options: StoreDefinitionOptions<S, G, A>,
    host: StoreHost,
): Store<S, G, A> {
    if (!options || typeof options.state !== 'function') {
        throw new Error(
            `Store "${name}": options.state must be a function returning the initial state.`,
        );
    }

    const initialState = options.state();
    validateNames(name, initialState, options);

    const state = reactive(initialState);

    /** Store-wide "something changed" channel backing `subscribe()`. */
    const dependency = new Dependency();
    const subscribers = new Set<StoreSubscriber<S>>();

    /** Everything the store owns, released together by `$destroy`. */
    const scope: EffectScope = effectScope();

    /**
     * Per-action lifecycle state, keyed by action name.
     *
     * Declared here rather than beside the action wiring below because the
     * store's coarse change-notifier has to depend on it: `pending`/`error`
     * are reactive in their own right, but they live on a *separate* reactive
     * object from `state`, so an effect watching only `state` never wakes when
     * they flip. That made `store.subscribe()` — and everything built on it,
     * including React's `useQuanta` — miss them entirely, except when an
     * action happened to also write state at around the same time, which made
     * it look intermittently correct.
     */
    const asyncState = reactive<
        Record<string, { pending: number; error: Error | null }>
    >({});

    scope.run(() => {
        reactiveEffect(
            () => {
                // Subscribe once to each object's coarse channel instead of
                // once per key. Reading ANY_CHANGE registers this effect
                // against a single dependency that `trigger` notifies for any
                // key on that object, so the cost of a write no longer grows
                // with the number of state keys.
                //
                // Previously this body enumerated every state key and every
                // action's lifecycle entry. Because an effect re-runs to
                // re-register its dependencies, that made a single `count++`
                // cost O(state size): measured at 5.7us on a 5-key store and
                // 439us on a 400-key store, a 76x regression for 80x the keys.
                trackAnyChange(state);
                trackAnyChange(asyncState);
            },
            {
                // The scheduler fires instead of the body, so dependencies are
                // registered once and never re-registered. Subscriber
                // callbacks routinely read reactive state, and running them
                // outside a tracking context is what stops this effect's
                // dependency set growing on every notification.
                scheduler: () => {
                    const previous = pauseTracking();
                    try {
                        notifyDependency(dependency, []);
                    } finally {
                        resumeTracking(previous);
                    }
                },
            },
        );
    });

    // ---- getters -----------------------------------------------------
    type GetterRefs = { [K in keyof G]: ComputedRef<ReturnType<G[K]>> };
    // Built through a loose record because a mapped type over an unresolved
    // generic is read-only from TypeScript's point of view.
    const getterRefs: Record<string, ComputedRef<unknown>> = {};

    if (options.getters) {
        const definitions = options.getters as Record<
            string,
            (state: S) => unknown
        >;
        scope.run(() => {
            for (const key of Object.keys(definitions)) {
                const getterFn = definitions[key];
                getterRefs[key] = computed(() => getterFn(state));
            }
        });
    }
    const getters = getterRefs as GetterRefs;

    // ---- persistence -------------------------------------------------
    let persistenceManager: PersistenceManager | null = null;

    // Allocated lazily: most stores have no persistence and nobody awaits
    // `$hydrated`, so a Promise per store is measurable when an app creates
    // many of them.
    let hydrationPromise: Promise<void> | null = null;
    let hydrationResolve: (() => void) | null = null;
    let hydrationSettled = !options.persist;

    const settleHydration = (): void => {
        hydrationSettled = true;
        hydrationResolve?.();
    };

    const getHydrated = (): Promise<void> => {
        if (hydrationPromise === null) {
            hydrationPromise = hydrationSettled
                ? Promise.resolve()
                : new Promise<void>((resolve) => {
                      hydrationResolve = resolve;
                  });
        }
        return hydrationPromise;
    };

    if (options.persist) {
        persistenceManager = createPersistenceManager<Record<string, unknown>>(
            () => state as unknown as Record<string, unknown>,
            (incoming) => mergeExternal(state, incoming, name),
            () => notifyDependency(dependency, []),
            options.persist as unknown as PersistenceConfig<
                Record<string, unknown>
            >,
            name,
            settleHydration,
        );
    }

    // ---- store object ------------------------------------------------
    const store = {
        state,
        getters,
        actions: {} as Record<string, unknown>,
        $id: name,

        subscribe(callback: StoreSubscriber<S>): () => void {
            subscribers.add(callback);
            dependency.depend(callback as () => void);
            return () => {
                subscribers.delete(callback);
                dependency.remove(callback as () => void);
            };
        },

        notifyAll(): void {
            for (const cb of [...subscribers]) {
                try {
                    cb(state);
                } catch (error) {
                    if (__DEV__) {
                        logger.warn(
                            `Store "${name}": subscriber threw: ${
                                error instanceof Error
                                    ? error.message
                                    : String(error)
                            }`,
                        );
                    }
                }
            }
        },

        /**
         * Apply several changes as one notification.
         *
         * Accepts either a partial object or a mutator function. Without this,
         * updating three fields wakes every subscriber three times.
         */
        $patch(partialOrMutator: Partial<S> | ((draft: S) => void)): void {
            batchEffects(() => {
                if (typeof partialOrMutator === 'function') {
                    partialOrMutator(state);
                    return;
                }
                const live = state as Record<string, unknown>;
                for (const key of Object.keys(partialOrMutator)) {
                    if (!isSafeKey(key)) continue;
                    live[key] = (partialOrMutator as Record<string, unknown>)[
                        key
                    ];
                }
            });
        },

        /** Restore the state produced by the original factory, in one batch. */
        $reset(): void {
            const fresh = options.state() as Record<string, unknown>;
            const live = state as Record<string, unknown>;

            batchEffects(() => {
                for (const key of Object.keys(fresh)) {
                    if (!Object.is(live[key], fresh[key])) {
                        live[key] = fresh[key];
                    }
                }
                // Snapshot the key list first — deleting while iterating the
                // object being mutated skips entries.
                for (const key of Object.keys(live)) {
                    if (!(key in fresh)) delete live[key];
                }
            });
        },

        /**
         * A plain, non-reactive copy of the state, safe to serialise.
         *
         * `toRaw` unwraps the proxy so that neither the traps nor dependency
         * tracking run during serialisation.
         */
        $dehydrate(): S {
            return structuredCopy(toRaw(state)) as S;
        },

        /** Replace state from a snapshot, as one notification. */
        $hydrate(snapshot: Partial<S>): void {
            if (!snapshot || typeof snapshot !== 'object') return;
            mergeExternal(state, snapshot as Record<string, unknown>, name);
        },

        $persist: persistenceManager,

        /**
         * Resolves once the first hydration attempt has settled, successfully
         * or not. Always present — a store without persistence resolves
         * immediately — so `await store.$hydrated` is unconditionally safe.
         */
        get $hydrated(): Promise<void> {
            return getHydrated();
        },

        $destroy(): void {
            try {
                persistenceManager?.destroy();
                for (const controller of inFlight.values()) {
                    controller.abortAll('store destroyed');
                }
                inFlight.clear();
                scope.stop();
                dependency.clear();
                subscribers.clear();
                host.onDestroy();
                devtools.unregisterStore(name);
            } catch (error) {
                if (__DEV__) {
                    logger.error(
                        `Store "${name}": destroy failed: ${
                            error instanceof Error
                                ? error.message
                                : String(error)
                        }`,
                    );
                }
            }
        },
    };

    const flattened = flattenStore(
        store as unknown as Parameters<typeof flattenStore>[0],
    ) as unknown as Store<S, G, A>;

    // ---- actions -----------------------------------------------------
    // `asyncState` is declared above, alongside the change-notifier that has
    // to depend on it.
    const inFlight = new Map<string, AbortGroup>();

    if (options.actions) {
        for (const key of Object.keys(options.actions)) {
            const actionFn = options.actions[key] as (
                ...args: unknown[]
            ) => unknown;
            (store.actions as Record<string, unknown>)[key] = makeAction(
                name,
                key,
                actionFn,
                flattened,
                asyncState,
                inFlight,
            );
        }
    }

    return flattened;
}

/**
 * Register the current effect against an object's coarse "anything changed"
 * channel — one dependency for the whole object, regardless of its size.
 */
function trackAnyChange(target: object): void {
    track(toRaw(target), ANY_CHANGE);
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

/** Tracks the AbortControllers for one action's in-flight invocations. */
interface AbortGroup {
    add(controller: AbortController): void;
    remove(controller: AbortController): void;
    abortAll(reason?: unknown): void;
}

function createAbortGroup(): AbortGroup {
    const controllers = new Set<AbortController>();
    return {
        add: (c) => controllers.add(c),
        remove: (c) => controllers.delete(c),
        abortAll(reason) {
            for (const c of [...controllers]) {
                try {
                    c.abort(reason);
                } catch {
                    /* already aborted */
                }
            }
            controllers.clear();
        },
    };
}

/**
 * Wrap a user action so it batches, reports to DevTools, and exposes
 * `pending` / `error` / `abort()`.
 *
 * The lifecycle surface is attached to **synchronous** actions too — `pending`
 * is simply never true — so that turning an action async later is not a
 * breaking change for its callers.
 *
 * Scope is deliberately narrow: loading and error flags plus an `AbortSignal`.
 * No caching, retries, deduplication or invalidation — that is a server-state
 * library's job, and a half-built one here would be worse than none.
 */
function makeAction(
    storeName: string,
    actionName: string,
    actionFn: (...args: unknown[]) => unknown,
    boundTo: object,
    asyncState: Record<string, { pending: number; error: Error | null }>,
    inFlight: Map<string, AbortGroup>,
): unknown {
    asyncState[actionName] = { pending: 0, error: null };

    const group = createAbortGroup();
    inFlight.set(actionName, group);

    const invoke = (...args: unknown[]): unknown => {
        if (devtools.enabled) {
            devtools.notifyActionCall(storeName, actionName, args);
        }

        const controller =
            typeof AbortController !== 'undefined'
                ? new AbortController()
                : null;

        // `this.$signal` is only meaningful for the duration of this call, so
        // it is swapped in around the invocation rather than living on the
        // store permanently.
        const previousSignal = (boundTo as { $signal?: AbortSignal }).$signal;

        const entry = asyncState[actionName];

        const settle = (error?: unknown): void => {
            batchEffects(() => {
                entry.pending = Math.max(0, entry.pending - 1);
                if (error !== undefined) {
                    entry.error =
                        error instanceof Error
                            ? error
                            : new Error(String(error));
                }
            });
            if (controller) group.remove(controller);
        };

        try {
            Object.defineProperty(boundTo, '$signal', {
                value: controller?.signal,
                configurable: true,
                enumerable: false,
                writable: true,
            });

            // Actions are the unit of change: one batch spans the lifecycle
            // bookkeeping *and* the action body, so subscribers wake once per
            // call rather than once per field written. A synchronous action
            // settles inside this same batch — its `pending` never being
            // observable from outside is the point — while an async one
            // returns at its first await, flushing a single "started"
            // notification and settling later in its own batch.
            const result = batchEffects(() => {
                entry.pending++;
                entry.error = null;
                if (controller) group.add(controller);

                let value: unknown;
                try {
                    value = actionFn.apply(boundTo, args);
                } catch (error) {
                    settle(error);
                    throw error;
                }

                if (!isThenable(value)) settle();
                return value;
            }) as unknown;

            if (isThenable(result)) {
                return result.then(
                    (value) => {
                        settle();
                        return value;
                    },
                    (error: unknown) => {
                        settle(error);
                        throw error;
                    },
                );
            }

            return result;
        } finally {
            Object.defineProperty(boundTo, '$signal', {
                value: previousSignal,
                configurable: true,
                enumerable: false,
                writable: true,
            });
        }
    };

    // Reading `.pending` / `.error` goes through the reactive `asyncState`
    // object, so a component that reads them re-renders when they change.
    Object.defineProperties(invoke, {
        pending: {
            get: () => asyncState[actionName].pending > 0,
            enumerable: true,
        },
        error: {
            get: () => asyncState[actionName].error,
            enumerable: true,
        },
        abort: {
            value: (reason?: unknown) => group.abortAll(reason),
            enumerable: false,
        },
    } satisfies Record<keyof ActionState, PropertyDescriptor>);

    return invoke;
}

function isThenable(value: unknown): value is Promise<unknown> {
    return (
        value !== null &&
        (typeof value === 'object' || typeof value === 'function') &&
        typeof (value as { then?: unknown }).then === 'function'
    );
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Merge externally-sourced state (a persistence payload, a cross-tab event, a
 * server snapshot) into the live store, as one notification.
 *
 * Dangerous keys are rejected here as the last line of defence: the ingest
 * layers sanitise already, but this is the only place outside data reaches the
 * state object, so the check belongs here too.
 */
function mergeExternal(
    state: object,
    incoming: Record<string, unknown>,
    storeName: string,
): void {
    const live = state as Record<string, unknown>;
    batchEffects(() => {
        for (const key of Object.keys(incoming)) {
            if (!isSafeKey(key)) {
                if (__DEV__) {
                    logger.warn(
                        `Store "${storeName}": refused to hydrate unsafe key "${key}".`,
                    );
                }
                continue;
            }
            const value = incoming[key];
            if (!Object.is(live[key], value)) live[key] = value;
        }
    });
}

/**
 * Deep copy for dehydration.
 *
 * `structuredClone` where available (it preserves Date, Map and Set, which a
 * JSON round-trip destroys), falling back to a manual walk on older runtimes.
 */
function structuredCopy<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch {
            // Functions, DOM nodes and class instances are not cloneable —
            // fall through rather than failing the whole dehydration.
        }
    }
    return manualCopy(value, new WeakMap());
}

function manualCopy<T>(value: T, seen: WeakMap<object, unknown>): T {
    if (value === null || typeof value !== 'object') return value;

    const source = value as unknown as object;
    const existing = seen.get(source);
    if (existing !== undefined) return existing as T;

    if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
    if (value instanceof Map) {
        const out = new Map();
        seen.set(source, out);
        for (const [k, v] of value) out.set(k, manualCopy(v, seen));
        return out as unknown as T;
    }
    if (value instanceof Set) {
        const out = new Set();
        seen.set(source, out);
        for (const v of value) out.add(manualCopy(v, seen));
        return out as unknown as T;
    }
    if (Array.isArray(value)) {
        const out: unknown[] = [];
        seen.set(source, out);
        for (const item of value) out.push(manualCopy(item, seen));
        return out as unknown as T;
    }

    const out: Record<string, unknown> = {};
    seen.set(source, out);
    for (const key of Object.keys(value as Record<string, unknown>)) {
        out[key] = manualCopy((value as Record<string, unknown>)[key], seen);
    }
    return out as unknown as T;
}

/** Reject names that would be unreachable or ambiguous on the flat store. */
function validateNames<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(
    name: string,
    initialState: S,
    options: StoreDefinitionOptions<S, G, A>,
): void {
    const stateKeys = new Set(Object.keys(initialState));
    const getterKeys = new Set(Object.keys(options.getters ?? {}));

    if (__DEV__) {
        for (const key of getterKeys) {
            if (stateKeys.has(key)) {
                logger.warn(
                    `Store "${name}": getter "${key}" shadows a state property. The getter wins on the flat store; the state value is still reachable at store.state.${key}.`,
                );
            }
        }
    }

    for (const key of Object.keys(options.actions ?? {})) {
        if (stateKeys.has(key)) {
            throw new Error(
                `Store "${name}": action "${key}" conflicts with a state property of the same name.`,
            );
        }
        if (getterKeys.has(key)) {
            throw new Error(
                `Store "${name}": action "${key}" conflicts with a getter of the same name.`,
            );
        }
    }
}
