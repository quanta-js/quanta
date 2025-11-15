import type { PersistenceConfig, PersistenceManager } from '../persistence';

/* ---------- Core building blocks ---------- */

export type StateDefinition<S> = () => S;

/**
 * Raw actions shape (user-provided action signatures)
 */
export type RawActions = Record<string, (...args: any[]) => any>;

/* Subscriber type */
export type StoreSubscriber<S = any> = (snapshot?: S) => void;

/* ---------- Getter types ---------- */

/**
 * GetterDefinitions: user writes getter functions in this shape.
 * Example:
 *   getters: {
 *     filteredTasks: (state) => state.tasks.filter(...)
 *   }
 *
 * GDefs maps getter name -> (state: S) => ReturnType
 */
export type GetterDefinitions<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
> = {
    [K in keyof GDefs]: (state: S) => ReturnType<GDefs[K]>;
};

/**
 * InferGetterReturnTypesFromDefs
 * - Derive the *runtime* getter value types from the getter function defs.
 * - This is what the flattened store exposes as properties.
 */
export type InferGetterReturnTypesFromDefs<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
> = {
    [K in keyof GDefs]: GDefs[K] extends (s: S) => infer R ? R : never;
};

/* ---------- Action types ---------- */

/**
 * ActionDefinition (user-facing)
 * - The object you pass as `actions` to createStore should match this shape.
 * - Inside these functions, `this` is the full runtime StoreInstance.
 */
export type ActionDefinition<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
> = {
    [K in keyof A]: A[K] extends (...args: infer P) => infer R
        ? (this: StoreInstance<S, GDefs, A>, ...args: P) => R
        : never;
};

/**
 * InferActions (runtime/action methods on flattened store)
 * - Converts the raw action signatures into functions whose `this` is the StoreInstance.
 */
export type InferActions<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
> = {
    [K in keyof A]: A[K] extends (...args: infer P) => infer R
        ? (this: StoreInstance<S, GDefs, A>, ...args: P) => R
        : never;
};

/* ---------- StoreOptions (user-facing) ---------- */

export type StoreOptions<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
> = {
    state: StateDefinition<S>;
    getters?: GetterDefinitions<S, GDefs>;
    actions?: ActionDefinition<S, GDefs, A>;
    persist?: PersistenceConfig<S>;
};

/* ---------- Final flattened StoreInstance (runtime) ---------- */

/**
 * StoreInstance:
 * - Exposes state keys (S)
 * - Exposes getter values (derived from GDefs)
 * - Exposes action methods (InferActions)
 * - Includes runtime helpers (state/getters/actions refs, subscribe, $reset etc.)
 */
export type StoreInstance<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
> = S &
    InferGetterReturnTypesFromDefs<S, GDefs> &
    InferActions<S, GDefs, A> & {
        state: S;
        getters: { [K in keyof GDefs]: any };
        actions: A;
        subscribe: (callback: StoreSubscriber) => () => void;
        $reset: () => void;
        $persist?: PersistenceManager;
        $destroy?: () => void;
    };
