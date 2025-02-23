export type StateDefinition<S> = () => S;

export type GetterDefinition<S, G> = {
    [key in keyof G]: (state: S) => G[key];
};

export type ActionDefinition<S, G, A> = {
    [key in keyof A]: (this: Store<S, G, A>, ...args: any[]) => any;
};

export interface Store<S, G, A> {
    state: S;
    getters: G;
    actions: A;
}
