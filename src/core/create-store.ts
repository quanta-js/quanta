import {
    ActionDefinition,
    GetterDefinition,
    StateDefinition,
    Store,
    StoreInstance,
} from 'type/store-types';
import { reactive, computed } from '../state';
import { flattenStore } from '../utils/flattenStore';

const storeRegistry = new Map<string, StoreInstance<any, any, any>>();

const createStore = <S extends object, G extends object, A extends object>(
    name: string,
    options: {
        state: StateDefinition<S>;
        getters?: GetterDefinition<S, G>;
        actions?: ActionDefinition<S, G, A>;
    },
): StoreInstance<S, G, A> => {
    if (storeRegistry.has(name)) {
        throw new Error(`Store with name "${name}" already exists.`);
    }

    // Create reactive state
    const state = reactive(options.state());

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
    };

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
