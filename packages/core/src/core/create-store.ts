import {
    ActionDefinition,
    GetterDefinition,
    StateDefinition,
    Store,
    StoreInstance,
    StoreSubscriber,
} from '../type/store-types';
import { reactive, computed } from '../state';
import { flattenStore } from '../utils/flattenStore';
import { Dependency } from './dependency';
import { trigger } from './effect';

const storeRegistry = new Map<string, StoreInstance<any, any, any>>();
const initialStateMap = new WeakMap<StoreInstance<any, any, any>, any>();

const createStore = <
    S extends object,
    G extends object,
    A extends Record<string, (...args: any[]) => any>,
>(
    name: string,
    options: {
        state: StateDefinition<S>;
        getters?: GetterDefinition<S, G>;
        actions?: ActionDefinition<S, G, A>;
    } & ThisType<S & { [K in keyof G]: G[K] } & A>,
): StoreInstance<S, G, A> => {
    if (storeRegistry.has(name)) {
        throw new Error(`Store with name "${name}" already exists.`);
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
            const getterFn = options.getters[key];
            getters[key as keyof G] = computed(() =>
                getterFn(state),
            ) as G[keyof G];
        }
    }

    // Define Actions
    const store = {
        state,
        getters,
        actions: {} as A,
        subscribe: (callback: StoreSubscriber) => {
            dependency.depend(callback);
            return () => dependency.remove(callback);
        },
        $reset: () => {
            const initial = initialStateMap.get(store);
            if (!initial) {
                throw new Error(`Initial state not found for store "${name}"`);
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
        },
    };

    // Save initial state
    initialStateMap.set(store, initialState);

    const flattenedStore = flattenStore(store);
    if (options.actions) {
        for (const key in options.actions) {
            const actionFn = options.actions[key];
            store.actions[key as keyof A] = actionFn.bind(
                flattenedStore,
            ) as A[keyof A];
        }
    }

    // Register the store
    storeRegistry.set(name, flattenedStore);

    return flattenedStore;
};

export default createStore;

// Utility to retrieve a store by name
export function useStore<S, G, A>(name: string): Store<S, G, A> {
    const store = storeRegistry.get(name);
    if (!store) {
        throw new Error(`Store with name "${name}" does not exist.`);
    }
    return store;
}
