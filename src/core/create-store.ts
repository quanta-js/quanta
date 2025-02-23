import {
    ActionDefinition,
    GetterDefinition,
    StateDefinition,
    Store,
} from 'type/store-types';
import { reactive, computed } from '../state';

const storeRegistry = new Map<string, Store<any, any, any>>();

const createStore = <S, G, A>(
    name: string,
    options: {
        state: StateDefinition<S>;
        getters?: GetterDefinition<S, G>;
        actions?: ActionDefinition<S, G, A>;
    },
): Store<S, G, A> => {
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

    // Define actions
    const store: Store<S, G, A> = {
        state,
        getters,
        actions: {} as A,
    };

    if (options.actions) {
        for (const key in options.actions) {
            const actionFn = options.actions[key];
            store.actions[key as keyof A] = actionFn.bind(store) as A[keyof A];
        }
    }

    // Register the store
    storeRegistry.set(name, store);

    return store;
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
