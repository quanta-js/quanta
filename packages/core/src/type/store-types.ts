import type { PersistenceConfig, PersistenceManager } from '../persistence';

/* ------------------------------------------------------------------ *
 * Building blocks
 * ------------------------------------------------------------------ */

/** The shape a `state()` factory must return. */
export type StateTree = Record<string, unknown>;

/** Factory that produces a fresh state object per store instance. */
export type StateDefinition<S> = () => S;

/** Getter definitions: pure functions of state. */
export type GettersTree<S> = Record<string, (state: S) => unknown>;

/** Action definitions. `this` is bound to the store instance. */

export type ActionsTree = Record<string, (...args: any[]) => any>;

/** Legacy alias kept because it reads better at some call sites. */
export type RawActions = ActionsTree;

/** Internal effect callback — no arguments. */
export type EffectFunction = () => void;

/** Store change subscriber — receives an optional state snapshot. */
export type StoreSubscriber<S = unknown> = (snapshot?: S) => void;

/** Disposable effect with `stop()` for cleanup. */
export type EffectDisposer = EffectFunction & { stop: () => void };

/* ------------------------------------------------------------------ *
 * Derived shapes
 * ------------------------------------------------------------------ */

/**
 * Getter *values* as seen on the flat store.
 *
 * Readonly because assigning to a getter is meaningless — the value is
 * derived, and the flat store rejects the write.
 */
export type UnwrapGetters<S, G extends GettersTree<S>> = {
    readonly [K in keyof G]: ReturnType<G[K]>;
};

/**
 * The `pending` / `error` / `abort()` surface attached to every action.
 *
 * Present on synchronous actions too — `pending` is simply never true — so
 * that changing an action from sync to async is not a breaking change for its
 * callers.
 */
export interface ActionState {
    /** True while at least one invocation is in flight. Reactive. */
    readonly pending: boolean;
    /** The most recent rejection, cleared when a new call starts. Reactive. */
    readonly error: Error | null;
    /** Abort every in-flight invocation of this action. */
    abort(reason?: unknown): void;
}

/** An action as exposed on the store: callable, plus its lifecycle state. */
export type BoundAction<F> = F extends (...args: infer P) => infer R
    ? ((...args: P) => R) & ActionState
    : never;

/** Every action on the store, each carrying its lifecycle state. */
export type BoundActions<A extends ActionsTree> = {
    [K in keyof A]: BoundAction<A[K]>;
};

/* ------------------------------------------------------------------ *
 * The store instance
 * ------------------------------------------------------------------ */

/** Framework-facing API present on every store, whatever its shape. */
export interface StoreApi<S, G extends GettersTree<S>, A extends ActionsTree> {
    /** The reactive state object. */
    readonly state: S;
    /** Raw computed refs, when you need `.value` rather than the flat value. */
    readonly getters: { readonly [K in keyof G]: { value: ReturnType<G[K]> } };
    /** Raw action functions. */
    readonly actions: BoundActions<A>;
    /** This store's registered name. */
    readonly $id: string;
    /**
     * `AbortSignal` for the action currently executing, or `undefined` outside
     * one. Pass it to `fetch` so `action.abort()` cancels in-flight work.
     */
    readonly $signal: AbortSignal | undefined;

    /** Subscribe to any change in this store. Returns an unsubscribe. */
    subscribe(callback: StoreSubscriber<S>): () => void;
    /** Notify subscribers manually. */
    notifyAll(): void;

    /** Apply several mutations as one notification. */
    $patch(partial: Partial<S>): void;
    /** Apply mutations imperatively as one notification. */
    $patch(mutator: (state: S) => void): void;

    /** Restore the state produced by the original factory. */
    $reset(): void;
    /** Persistence manager, when `persist` was configured. */
    readonly $persist: PersistenceManager | null;
    /** Resolves once the first hydration attempt has settled. */
    readonly $hydrated: Promise<void>;
    /** Serialisable snapshot of this store's state. */
    $dehydrate(): S;
    /** Replace state from a snapshot, as one notification. */
    $hydrate(snapshot: Partial<S>): void;
    /** Release every effect, subscriber and watcher this store owns. */
    $destroy(): void;
}

/**
 * A fully-typed store: state, getter values and actions flattened onto one
 * object, plus the framework API.
 */

export type Store<
    S extends StateTree,
    G extends GettersTree<S> = {},
    A extends ActionsTree = {},
> = S & UnwrapGetters<S, G> & BoundActions<A> & StoreApi<S, G, A>;

/**
 * A store of unknown shape.
 *
 * Used where the concrete generics are not knowable — container internals,
 * name-based lookup, DevTools. Prefer the inferred `Store<S, G, A>` everywhere
 * a definition is in scope.
 */
export type AnyStore = Store<StateTree, GettersTree<StateTree>, ActionsTree>;

/**
 * Options accepted by `defineStore`.
 *
 * `ThisType` is what makes `this` inside an action resolve to the whole store
 * — state, getters, other actions and the `$`-API — while still letting
 * TypeScript infer `A` from the object literal. Annotating `this` by hand
 * instead would defeat that inference.
 */
export interface StoreDefinitionOptions<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
> {
    /** Produces a fresh state object. Called once per store instance. */
    state: StateDefinition<S>;
    /**
     * Pure derivations of state, cached until their dependencies change.
     *
     * The `& GettersTree<S>` intersection is what contextually types the
     * `state` parameter — without it each getter's argument is an implicit
     * `any`, which quietly defeats the point of the whole definition.
     */
    getters?: G & GettersTree<S> & ThisType<void>;
    /** Methods that mutate state. `this` is the store. */
    actions?: A & ThisType<Store<S, G, A>>;
    /** Persist this store's state through a storage adapter. */
    persist?: PersistenceConfig<S>;
}

/* ------------------------------------------------------------------ *
 * Back-compat aliases
 * ------------------------------------------------------------------ */

/** @deprecated Use {@link GettersTree}. */
export type GetterDefinitions<
    S extends object,
    GDefs extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
> = GDefs;

/** @deprecated Use {@link ActionsTree}. */
export type ActionDefinition<
    S extends object,
    G extends Record<string, (state: S) => unknown>,
    A extends ActionsTree,
> = A;

/** @deprecated Use {@link BoundActions}. */
export type InferActions<
    S extends object,
    G extends Record<string, (state: S) => unknown>,
    A extends ActionsTree,
> = BoundActions<A>;

/** @deprecated Use {@link Store}. */
export type StoreInstance<
    S extends object,
    G extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends ActionsTree = ActionsTree,
> = Store<S & StateTree, G & GettersTree<S & StateTree>, A>;

/** @deprecated Use {@link StoreDefinitionOptions}. */
export type StoreOptions<
    S extends object,
    G extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends ActionsTree = ActionsTree,
> = StoreDefinitionOptions<S & StateTree, G & GettersTree<S & StateTree>, A>;
