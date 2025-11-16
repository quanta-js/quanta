import {
    StoreInstance,
    StoreSubscriber,
    StoreOptions,
    RawActions,
} from '../type/store-types';
import { reactive, computed } from '../state';
import { flattenStore } from '../utils/flattenStore';
import { Dependency } from './dependency';
import { reactiveEffect, targetMap, trigger } from './effect';
import { createPersistenceManager } from '../persistence';
import { logger } from '../services/logger-service';

const storeRegistry = new Map<string, StoreInstance<any, any, any>>();
const initialStateMap = new WeakMap<StoreInstance<any, any, any>, any>();

export const createStore = <
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
>(
    name: string,
    options: StoreOptions<S, GDefs, A>,
): StoreInstance<S, GDefs, A> => {
    try {
        if (storeRegistry.has(name)) {
            const errorMessage = `Store with name "${name}" already exists.`;
            logger.error(`Store: ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Create reactive state
        const initialState = options.state();
        const state = reactive(initialState);

        // Pre-touch to cache Proxies + set parents before watcher
        Object.keys(state).forEach((key) => {
            const _val = (state as any)[key]; // Triggers get -> caches nested Proxy + parentMap
        });
        logger.debug(
            `Store ${name}: Pre-touched deps: ${Object.keys(targetMap.get(state) || {})}`,
        );

        // Create dependency tracker for store updates
        const dependency = new Dependency();

        // registerDeepStoreWatcher
        (() => {
            try {
                reactiveEffect(() => {
                    // Access top-level keys ONLY — cheap and sufficient
                    for (const key in state) {
                        // Access each key so proxy tracks dependencies
                        const _ = (state as any)[key];
                    }

                    // Notify subscribers (React/Vue/Svelte integrations)
                    dependency.notify(state);
                });
                logger.debug(
                    `Watcher: Tracked top-level deps: ${Object.keys(targetMap.get(state) || {})}`,
                );
            } catch (err) {
                logger.warn(
                    `createStore: Failed to register deep watcher for store "${name}": ${
                        err instanceof Error ? err.message : String(err)
                    }`,
                );
            }
        })();

        // Compute getters
        type GetterValues = {
            [K in keyof GDefs]: ReturnType<GDefs[K]>;
        };

        // Build raw computed getter functions with correct typing
        const getters: { [K in keyof GDefs]: { value: GetterValues[K] } } =
            {} as any;
        if (options.getters) {
            for (const key in options.getters) {
                try {
                    const getterFn = options.getters[key];
                    getters[key] = computed(() => getterFn(state)) as any;
                } catch (error) {
                    logger.error(
                        `Store: Failed to create getter "${String(key)}" for store "${name}": ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            }
        }

        // Set up persistence if configured
        let persistenceManager: any = null;

        if (options.persist) {
            try {
                persistenceManager = createPersistenceManager(
                    () => state,
                    (newState: Partial<S>) => {
                        try {
                            // Update state properties
                            for (const key in newState) {
                                if ((state as any)[key] !== newState[key]) {
                                    (state as any)[key] = newState[key];
                                    trigger(state, key);
                                }
                            }
                        } catch (error) {
                            logger.error(
                                `Store: Persistence state update failed for store "${name}": ${error instanceof Error ? error.message : String(error)}`,
                            );
                            throw error;
                        }
                    },
                    () => dependency.notify(),
                    options.persist,
                    name,
                );
            } catch (error) {
                logger.error(
                    `Store: Failed to set up persistence for store "${name}": ${error instanceof Error ? error.message : String(error)}`,
                );
                throw error;
            }
        }

        // Store-level subscribers for broad "onAnyChange" (framework-safe)
        const subscribers = new Set<StoreSubscriber>();

        // Define core store object
        const store = {
            state,
            getters,
            actions: {} as A,
            subscribe: (callback: StoreSubscriber) => {
                try {
                    subscribers.add(callback);
                    dependency.depend(callback);
                    return () => {
                        try {
                            subscribers.delete(callback);
                            dependency.remove(callback);
                        } catch (error) {
                            logger.error(
                                `Store: Failed to remove subscriber from store "${name}": ${error instanceof Error ? error.message : String(error)}`,
                            );
                        }
                    };
                } catch (error) {
                    logger.error(
                        `Store: Failed to add subscriber to store "${name}": ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            },
            notifyAll: () => {
                try {
                    const snapshot = store.state; // Fresh ref for subs
                    subscribers.forEach((cb) => {
                        try {
                            cb(snapshot);
                        } catch (e) {
                            logger.warn(
                                `Store: Subscriber callback failed for "${name}": ${e instanceof Error ? e.message : String(e)}`,
                            );
                        }
                    });
                } catch (error) {
                    logger.error(
                        `Store: notifyAll failed for "${name}": ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            },
            $reset: () => {
                try {
                    const initial = initialStateMap.get(store);
                    if (!initial) {
                        const errorMessage = `Initial state not found for store "${name}"`;
                        logger.error(`Store: ${errorMessage}`);
                        throw new Error(errorMessage);
                    }

                    // Update state properties with initial values
                    for (const key in initial) {
                        if ((store.state as any)[key] !== initial[key]) {
                            (store.state as any)[key] = initial[key];
                            trigger(store.state, key); // Trigger reactivity for changed properties
                        }
                    }

                    // Remove properties not in initial state
                    for (const key in store.state) {
                        if (!(key in initial)) {
                            delete (store.state as any)[key];
                            trigger(store.state, key); // Trigger reactivity for deleted properties
                        }
                    }
                } catch (error) {
                    logger.error(
                        `Store: Failed to reset store "${name}": ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            },
            $persist: persistenceManager,
            $destroy: () => {
                try {
                    store.$persist?.destroy?.();
                    dependency.clear();
                    subscribers.clear();
                    logger.debug(`Store: Destroyed "${name}"`);
                } catch (error) {
                    logger.error(
                        `Store: Destroy failed for "${name}": ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            },
        };

        // Save initial state
        initialStateMap.set(store, initialState);

        const flattenedStore = flattenStore<S, GDefs, A>(store);
        if (options.actions) {
            for (const key in options.actions) {
                try {
                    const actionFn = options.actions[key];
                    (store.actions as any)[key] = actionFn.bind(flattenedStore);
                } catch (error) {
                    logger.error(
                        `Store: Failed to create action "${String(key)}" for store "${name}": ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            }
        }

        // Register the store
        storeRegistry.set(name, flattenedStore);

        return flattenedStore;
    } catch (error) {
        logger.error(
            `Store: Failed to create store "${name}": ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
};

export default createStore;

// Utility to retrieve a store by name
export function useStore<
    S extends object,
    G extends Record<string, any>,
    A extends RawActions,
>(name: string): StoreInstance<S, G, A> {
    try {
        const store = storeRegistry.get(name);
        if (!store) {
            const errorMessage = `Store with name "${name}" does not exist.`;
            logger.error(`Store: ${errorMessage}`);
            throw new Error(errorMessage);
        }
        return store;
    } catch (error) {
        logger.error(
            `Store: Failed to retrieve store "${name}": ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
}
