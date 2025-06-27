export type StateDefinition<S> = () => S;

export type GetterDefinition<S, G> = {
    [key in keyof G]: (state: S) => G[key];
};

export type ActionDefinition<S extends object, G extends object, A> = {
    [key in keyof A]: (this: StoreInstance<S, G, A>, ...args: any[]) => any;
} & ThisType<S & { [K in keyof G]: G[K] } & A>;

export type StoreSubscriber = () => void;

export interface Store<S, G, A> {
    state: S;
    getters: G;
    actions: A;
    subscribe: (callback: StoreSubscriber) => () => void;
}

// type FlattenedGetters<G> = {
//     [K in keyof G]: G[K] extends { value: infer V } ? V : never;
// };

export type StoreInstance<
    S extends object,
    G extends Record<string, any>,
    A,
> = S & { [K in keyof G]: G[K] } & A & {
        subscribe: (callback: StoreSubscriber) => () => void;
    };
