import type { PersistenceConfig, PersistenceManager } from '../persistence';

export type StateDefinition<S> = () => S;

export type GetterDefinition<S, G> = {
    [key in keyof G]: (state: S) => G[key];
};

export type ActionDefinition<S extends object, G extends object, A> = {
    [key in keyof A]: (this: StoreInstance<S, G, A>, ...args: any[]) => any;
} & ThisType<S & { [K in keyof G]: G[K] } & A>;

export type StoreSubscriber<S = any> = (snapshot?: S) => void;

export interface Store<S, G, A> {
    state: S;
    getters: G;
    actions: A;
    subscribe: (callback: StoreSubscriber<S>) => () => void;
    $reset: () => void;
    $persist?: PersistenceManager;
}

// type FlattenedGetters<G> = {
//     [K in keyof G]: G[K] extends { value: infer V } ? V : never;
// };

export type StoreInstance<
    S extends object,
    G extends Record<string, any>,
    A,
> = S & { [K in keyof G]: G[K] } & A & {
        state: S;
        getters: G;
        actions: A;
        subscribe: (callback: StoreSubscriber) => () => void;
        $reset: () => void;
        $persist?: PersistenceManager;
    };

// Enhanced store options with persistence support
export type StoreOptions<S extends object, G extends object, A> = {
    state: StateDefinition<S>;
    getters?: GetterDefinition<S, G>;
    actions?: ActionDefinition<S, G, A>;
    persist?: PersistenceConfig<S>;
} & ThisType<S & { [K in keyof G]: G[K] } & A>;
