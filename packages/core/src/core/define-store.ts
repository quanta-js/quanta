import type {
    ActionsTree,
    AnyStore,
    GettersTree,
    StateTree,
    Store,
    StoreDefinitionOptions,
} from '../type/store-types';
import {
    getDefaultContainer,
    resetDefaultContainer,
    type StoreContainer,
} from './container';

/**
 * A store blueprint: call it to get the instance for a container.
 *
 * The definition itself holds no state, so it is safe to create at module
 * scope and share across requests — which is what makes SSR work. State only
 * comes into existence when the definition is resolved against a container.
 */
export interface StoreDefinition<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
> {
    /**
     * Resolve this store.
     *
     * @param container - Which container to resolve against. Omit in the
     *   browser to use the ambient one; **always pass one on a server**, where
     *   the ambient container is shared across requests.
     */
    (container?: StoreContainer): Store<S, G, A>;

    /** The registered name. */
    readonly $id: string;
    /** The options this definition was created from. */
    readonly $options: StoreDefinitionOptions<S, G, A>;
}

/**
 * Define a store.
 *
 * Returns an accessor rather than an instance, which is what gives you two
 * things at once: **full type inference at every call site** (no generics to
 * restate, unlike a name-based lookup) and **per-container instances**, so the
 * same definition can back one instance per browser app, per server request,
 * or per test.
 *
 * @example
 * ```ts
 * export const useCart = defineStore('cart', {
 *     state: () => ({ items: [] as Item[] }),
 *     getters: {
 *         total: (s) => s.items.reduce((n, i) => n + i.price, 0),
 *     },
 *     actions: {
 *         add(item: Item) {
 *             this.items.push(item);   // `this` is the whole store, typed
 *         },
 *         async load(id: string) {
 *             const res = await fetch(`/carts/${id}`, { signal: this.$signal });
 *             this.items = await res.json();
 *         },
 *     },
 * });
 *
 * const cart = useCart();
 * cart.total;          // number — inferred
 * cart.add(item);      // typed
 * cart.load.pending;   // boolean
 * ```
 */
export function defineStore<
    S extends StateTree,
    G extends GettersTree<S> = {},
    A extends ActionsTree = {},
>(
    name: string,
    options: StoreDefinitionOptions<S, G, A>,
): StoreDefinition<S, G, A> {
    if (typeof name !== 'string' || name.length === 0) {
        throw new Error('defineStore: a non-empty store name is required.');
    }

    const definition = ((container?: StoreContainer) =>
        (container ?? getDefaultContainer()).resolve(
            name,
            options,
        )) as StoreDefinition<S, G, A>;

    Object.defineProperties(definition, {
        $id: { value: name, enumerable: true },
        $options: { value: options, enumerable: true },
    });

    return definition;
}

/**
 * Create a store immediately in a container.
 *
 * The eager counterpart to {@link defineStore}: use it when you want the
 * instance right now rather than an accessor. Prefer `defineStore` in shared
 * modules — a definition holds no state, so it is safe to create at module
 * scope, whereas an instance is not.
 *
 * Resolving the same name twice in one container returns the existing
 * instance, so hot-module replacement, StrictMode double-mounts and repeated
 * test setup are all safe.
 */
export function createStore<
    S extends StateTree,
    G extends GettersTree<S> = {},
    A extends ActionsTree = {},
>(
    name: string,
    options: StoreDefinitionOptions<S, G, A>,
    container?: StoreContainer,
): Store<S, G, A> {
    return (container ?? getDefaultContainer()).resolve(name, options);
}

/**
 * Retrieve a store that has already been created.
 *
 * Prefer calling a {@link StoreDefinition} — this returns a loosely-typed
 * store because a name alone carries no type information, which is exactly the
 * problem `defineStore` exists to solve.
 */
export function useStore(name: string, container?: StoreContainer): AnyStore {
    const target = container ?? getDefaultContainer();
    const store = target.get(name);
    if (!store) {
        throw new Error(
            `Store "${name}" does not exist in container "${target.id}". ` +
                `Existing stores: ${target.keys().join(', ') || '(none)'}.`,
        );
    }
    return store;
}

/** Whether a store with this name exists in the given (or ambient) container. */
export function hasStore(name: string, container?: StoreContainer): boolean {
    return (container ?? getDefaultContainer()).has(name);
}

/**
 * Destroy every store in the ambient container and start a fresh one.
 *
 * The one-call teardown for a test suite.
 */
export function destroyAllStores(): void {
    resetDefaultContainer();
}
