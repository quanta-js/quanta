export type StateDefinition<S> = () => S;

export type GetterDefinition<S, G> = {
    [key in keyof G]: (state: S) => G[key];
};

export type ActionDefinition<S, G, A> = {
    [key in keyof A]: (this: StoreInstance<S, G, A>, ...args: any[]) => any;
};

export interface Store<S, G, A> {
    state: S;
    getters: G;
    actions: A;
}

type FlattenedGetters<G> = {
    [K in keyof G]: G[K] extends { value: infer V } ? V : never;
};

export type StoreInstance<
    S extends object,
    G extends object,
    A extends object,
> = S & FlattenedGetters<G> & A;
