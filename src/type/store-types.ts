export type StateDefinition<S> = () => S;

export type GetterDefinition<S, G> = {
    [key in keyof G]: (state: S) => G[key];
};

export type ActionDefinition<
    S extends object,
    G extends object,
    A extends object,
> = {
    [key in keyof A]: (this: StoreInstance<S, G, A>, ...args: any[]) => any;
};

export type StoreSubscriber = () => void;

export interface Store<S, G, A> {
    state: S;
    getters: G;
    actions: A;
    subscribe: (callback: StoreSubscriber) => () => void;
}

type FlattenedGetters<G> = {
    [K in keyof G]: G[K] extends { value: infer V } ? V : never;
};

export type StoreInstance<
    S extends object,
    G extends object,
    A extends object,
> = S &
    FlattenedGetters<G> &
    A & {
        subscribe: (callback: StoreSubscriber) => () => void;
    };
