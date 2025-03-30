import { StoreInstance } from '../type/store-types';

export const flattenStore = <
    S extends object,
    G extends object,
    A extends object,
>(store: {
    state: S;
    getters: G;
    actions: A;
}): StoreInstance<S, G, A> => {
    return new Proxy(store, {
        get(target, prop: string, receiver) {
            // Check in state
            if (prop in target.state) {
                return Reflect.get(target.state, prop);
            }
            // Check in getters (return the computed value)
            if (prop in target.getters) {
                const getter = Reflect.get(target.getters, prop);
                if (getter && typeof getter === 'object' && 'value' in getter) {
                    return getter.value;
                }
                return getter;
            }
            // Check in actions
            if (prop in target.actions) {
                return Reflect.get(target.actions, prop);
            }
            // Fallback to the original target (e.g. store.state, store.getters, etc.)
            return Reflect.get(target, prop, receiver);
        },
        set(target, prop: string, value, receiver) {
            // If the property exists in state, update it there
            if (prop in target.state) {
                return Reflect.set(target.state, prop, value);
            }
            // Otherwise, fallback to setting the property on the target
            return Reflect.set(target, prop, value, receiver);
        },
    }) as unknown as StoreInstance<S, G, A>;
};
