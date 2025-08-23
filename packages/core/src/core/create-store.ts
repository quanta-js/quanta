import {
    Store,
    StoreInstance,
    StoreSubscriber,
    StoreOptions,
} from '../type/store-types';
import { reactive, computed } from '../state';
import { flattenStore } from '../utils/flattenStore';
import { Dependency } from './dependency';
import { trigger } from './effect';
import { createPersistenceManager } from '../persistence';
import { logger } from '../services/logger-service';

const storeRegistry = new Map<string, StoreInstance<any, any, any>>();
const initialStateMap = new WeakMap<StoreInstance<any, any, any>, any>();

const createStore = <
    S extends object,
    G extends object,
    A extends Record<string, (...args: any[]) => any>,
>(
    name: string,
    options: StoreOptions<S, G, A>,
): StoreInstance<S, G, A> => {
    try {
        if (storeRegistry.has(name)) {
            const errorMessage = `Store with name "${name}" already exists.`;
            logger.error(`Store: ${errorMessage}`);
            throw new Error(errorMessage);
        }

        // Create reactive state
        const initialState = options.state();
        const state = reactive(initialState);

        // Create dependency tracker for store updates
        const dependency = new Dependency();

        // Compute getters
        const getters = {} as G;
        if (options.getters) {
            for (const key in options.getters) {
                try {
                    const getterFn = options.getters[key];
                    getters[key as keyof G] = computed(() =>
                        getterFn(state),
                    ) as G[keyof G];
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

        // Define Actions
        const store = {
            state,
            getters,
            actions: {} as A,
            subscribe: (callback: StoreSubscriber) => {
                try {
                    dependency.depend(callback);
                    return () => {
                        try {
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
        };

        // Save initial state
        initialStateMap.set(store, initialState);

        const flattenedStore = flattenStore(store);
        if (options.actions) {
            for (const key in options.actions) {
                try {
                    const actionFn = options.actions[key];
                    store.actions[key as keyof A] = actionFn.bind(
                        flattenedStore,
                    ) as A[keyof A];
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
export function useStore<S, G, A>(name: string): Store<S, G, A> {
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
