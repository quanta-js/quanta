import {
    StoreInstance,
    StoreSubscriber,
    StoreOptions,
    RawActions,
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

/**
 * Named stores, so `useStore(name)` and DevTools can find them.
 *
 * NOTE (SSR): this registry is module-global, which makes a store declared at
 * module scope a *process-wide singleton*. On a server that is shared across
 * requests. Until per-request containers land, server-rendered applications
 * must create stores per request and dispose them when the request ends —
 * `$destroy()` deregisters here, and `destroyAllStores()` clears the registry
 * for request or test teardown.
 */
const storeRegistry = new Map<string, StoreInstance<never, never, never>>();

/** store -> its state factory, for `$reset`. */
const initialStateMap = new WeakMap<object, () => object>();

/**
 * Create a named, reactive store.
 *
 * @param name    - Unique identifier used by `useStore` and DevTools.
 * @param options - State factory, optional getters, actions and persistence.
 *
 * @example
 * ```ts
 * const cart = createStore('cart', {
 *     state: () => ({ items: [] as Item[] }),
 *     getters: { total: (s) => s.items.reduce((n, i) => n + i.price, 0) },
 *     actions: {
 *         add(item: Item) { this.items.push(item); },
 *     },
 * });
 * ```
 */
export const createStore = <
    S extends object,
    GDefs extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends RawActions = RawActions,
>(
    name: string,
    options: StoreOptions<S, GDefs, A>,
): StoreInstance<S, GDefs, A> => {
    if (storeRegistry.has(name)) {
        throw new Error(
            `Store "${name}" already exists. Use getOrCreateStore("${name}", …) if you intend to reuse it (HMR, StrictMode, repeated test setup), or call store.$destroy() first.`,
        );
    }

    const initialState = options.state();
    validateNames(name, initialState, options);

    const state = reactive(initialState);

    /** Store-wide "something changed" channel used by framework adapters. */
    const dependency = new Dependency();
    const subscribers = new Set<StoreSubscriber>();

    /**
     * Everything the store owns, so `$destroy` releases it in one call rather
     * than tracking each disposer by hand.
     */
    const scope: EffectScope = effectScope();

    scope.run(() => {
        // Coarse "any top-level key changed" watcher backing `subscribe()`.
        // Reading each top-level key registers a dependency on it; nested
        // changes reach us by bubbling.
        reactiveEffect(() => {
            for (const key in state) {
                void (state as Record<string, unknown>)[key];
            }

            // Subscriber callbacks routinely read reactive state. Without
            // pausing, those reads would be attributed to *this* effect and
            // grow its dependency set on every notification.
            const previous = pauseTracking();
            try {
                notifyDependency(dependency, []);
            } finally {
                resumeTracking(previous);
            }
        });
    });

    // ---- getters -----------------------------------------------------
    type GetterRefs = { [K in keyof GDefs]: ComputedRef<ReturnType<GDefs[K]>> };
    const getters = {} as GetterRefs;

    if (options.getters) {
        scope.run(() => {
            for (const key in options.getters) {
                const getterFn = options.getters![key];
                getters[key] = computed(() =>
                    getterFn(state),
                ) as GetterRefs[typeof key];
            }
        });
    }

    // ---- persistence -------------------------------------------------
    let persistenceManager: PersistenceManager | null = null;

    /**
     * Hydration signal, allocated lazily.
     *
     * Most stores have no persistence and nobody awaits `$hydrated`, so
     * eagerly constructing a Promise per store is measurable overhead when an
     * application creates many of them. The Promise is therefore built on
     * first access, and `settleHydration()` records completion even if nobody
     * has asked yet.
     */
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
        // The persistence manager works structurally over string keys; S is
        // constrained to `object`, so widen at the call site rather than
        // tightening the public StoreOptions constraint.
        persistenceManager = createPersistenceManager<Record<string, unknown>>(
            () => state as Record<string, unknown>,
            (incoming) =>
                applyPersistedState(state, incoming as Partial<S>, name),
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
        actions: {} as A,

        subscribe(callback: StoreSubscriber): () => void {
            subscribers.add(callback);
            dependency.depend(callback);
            return () => {
                subscribers.delete(callback);
                dependency.remove(callback);
            };
        },

        notifyAll(): void {
            const snapshot = state;
            for (const cb of [...subscribers]) {
                try {
                    cb(snapshot);
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
         * Restore state to the value produced by the original state factory.
         *
         * Runs as one batch, so a reset of N keys wakes subscribers once
         * rather than N times.
         */
        $reset(): void {
            const factory = initialStateMap.get(store);
            if (!factory) {
                throw new Error(`Store "${name}": state factory not found.`);
            }

            const fresh = factory() as Record<string, unknown>;
            const live = state as Record<string, unknown>;

            batchEffects(() => {
                for (const key of Object.keys(fresh)) {
                    if (!Object.is(live[key], fresh[key])) {
                        live[key] = fresh[key];
                    }
                }
                // Snapshot the key list first: deleting while iterating the
                // object being mutated is undefined-ish and skips entries.
                for (const key of Object.keys(live)) {
                    if (!(key in fresh)) delete live[key];
                }
            });
        },

        $persist: persistenceManager,

        /**
         * Resolves once the first hydration attempt has settled (successfully
         * or not). Always present — a store without persistence resolves
         * immediately — so `await store.$hydrated` is unconditionally safe.
         *
         * This is what lets a server-rendered app wait for storage instead of
         * polling `$persist.isRehydrated()`, which is the root cause of
         * flash-of-unhydrated-content.
         */
        get $hydrated(): Promise<void> {
            return getHydrated();
        },

        $destroy(): void {
            try {
                persistenceManager?.destroy();
                // One call releases the deep watcher and every getter computed.
                scope.stop();
                dependency.clear();
                subscribers.clear();
                storeRegistry.delete(name);
                initialStateMap.delete(store);
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

    initialStateMap.set(store, options.state as () => object);

    const flattened = flattenStore<S, GDefs, A>(
        store as unknown as Parameters<typeof flattenStore<S, GDefs, A>>[0],
    );

    // ---- actions -----------------------------------------------------
    if (options.actions) {
        for (const key in options.actions) {
            const actionFn = options.actions[key] as (
                ...args: unknown[]
            ) => unknown;
            const bound = actionFn.bind(flattened);
            (store.actions as Record<string, unknown>)[key] = (
                ...args: unknown[]
            ) => {
                if (devtools.enabled) {
                    devtools.notifyActionCall(name, key, args);
                }
                // Actions are the unit of change: batching them means a
                // multi-write action notifies subscribers once.
                return batchEffects(() => bound(...args));
            };
        }
    }

    storeRegistry.set(
        name,
        flattened as unknown as StoreInstance<never, never, never>,
    );
    if (devtools.enabled) devtools.registerStore(name, store);

    return flattened;
};

export default createStore;

/**
 * Return the existing store with this name, or create it.
 *
 * `createStore` throws on a duplicate name, which is correct for catching a
 * genuine collision but hostile to hot-module replacement, React StrictMode's
 * double-mount and repeated test setup. Reach for this wherever a module may
 * legitimately evaluate more than once.
 */
export function getOrCreateStore<
    S extends object,
    GDefs extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends RawActions = RawActions,
>(
    name: string,
    options: StoreOptions<S, GDefs, A>,
): StoreInstance<S, GDefs, A> {
    const existing = storeRegistry.get(name);
    if (existing) return existing as unknown as StoreInstance<S, GDefs, A>;
    return createStore<S, GDefs, A>(name, options);
}

/** Retrieve a store previously created with {@link createStore}. */
export function useStore<
    S extends object,
    G extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends RawActions = RawActions,
>(name: string): StoreInstance<S, G, A> {
    const store = storeRegistry.get(name);
    if (!store) {
        throw new Error(
            `Store "${name}" does not exist. Create it with createStore("${name}", …) before calling useStore.`,
        );
    }
    return store as unknown as StoreInstance<S, G, A>;
}

/** Whether a store with this name is currently registered. */
export function hasStore(name: string): boolean {
    return storeRegistry.has(name);
}

/**
 * Destroy every registered store.
 *
 * Intended for test teardown and for disposing a server request's stores.
 */
export function destroyAllStores(): void {
    for (const store of [...storeRegistry.values()]) {
        (store as unknown as { $destroy: () => void }).$destroy();
    }
    storeRegistry.clear();
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/**
 * Merge externally-sourced state (a persistence payload, a cross-tab event)
 * into the live store.
 *
 * Dangerous keys are rejected here as the last line of defence: the
 * persistence layer already sanitises, but this function is the only place
 * outside data reaches the state object, so the check belongs here too.
 */
function applyPersistedState<S extends object>(
    state: S,
    incoming: Partial<S>,
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
            const value = (incoming as Record<string, unknown>)[key];
            if (!Object.is(live[key], value)) {
                live[key] = value;
            }
        }
    });
}

/** Reject action names that would be unreachable on the flat store. */
function validateNames<
    S extends object,
    GDefs extends Record<string, (state: S) => unknown>,
    A extends RawActions,
>(name: string, initialState: S, options: StoreOptions<S, GDefs, A>): void {
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
