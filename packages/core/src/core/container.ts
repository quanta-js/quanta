import type {
    ActionsTree,
    AnyStore,
    GettersTree,
    StateTree,
    Store,
    StoreDefinitionOptions,
} from '../type/store-types';
import { instantiateStore } from './create-store';
import { devtools } from '../devtools';
import { logger } from '../services/logger-service';
import { __DEV__ } from '../utils/env';
import { isSafeKey } from '../utils/sanitize';

/**
 * A serialisable snapshot of every store in a container.
 * Keyed by store name.
 */
export type ContainerSnapshot = Record<string, Record<string, unknown>>;

/**
 * An isolated set of store instances.
 *
 * ## Why containers exist
 *
 * Before this, stores lived in one module-global registry. That makes a
 * module-scope store a **process-wide singleton**, which is fine in a browser
 * tab — one user, one process — and unsafe on a server, where one Node process
 * serves every request. Request A writing `user.email` was visible to request
 * B: no error, no warning, just another user's data.
 *
 * A container is the unit of isolation. One per browser app, one per
 * server request, one per test.
 *
 * @example Server
 * ```ts
 * const container = createContainer();
 * const user = useUserStore(container);
 * user.load(req.userId);
 * const html = render(container);
 * const snapshot = container.dehydrate();
 * container.dispose();
 * ```
 */
export interface StoreContainer {
    /** Stable identifier, useful in logs and DevTools. */
    readonly id: string;
    /** Whether this container still accepts stores. */
    readonly active: boolean;

    /**
     * Resolve a store definition against this container, creating the instance
     * on first use. Calling it again with the same definition returns the same
     * instance — that idempotency is what makes HMR, StrictMode and repeated
     * test setup safe.
     */
    resolve<
        S extends StateTree,
        G extends GettersTree<S>,
        A extends ActionsTree,
    >(
        name: string,
        options: StoreDefinitionOptions<S, G, A>,
    ): Store<S, G, A>;

    /** A store already created in this container, by name. */
    get(name: string): AnyStore | undefined;
    /** Whether a store with this name exists in this container. */
    has(name: string): boolean;
    /** Names of every store created in this container. */
    keys(): string[];

    /**
     * Serialisable snapshot of every store's state.
     *
     * Call this on the server after rendering, embed the result in the HTML
     * payload, and pass it to {@link hydrate} on the client.
     */
    dehydrate(): ContainerSnapshot;

    /**
     * Apply a snapshot produced by {@link dehydrate}.
     *
     * Stores that do not yet exist have their snapshot held until they are
     * first resolved, so hydration order does not matter — a lazily-created
     * store still receives its server state.
     */
    hydrate(snapshot: ContainerSnapshot): void;

    /** Destroy every store in this container. Idempotent. */
    dispose(): void;
}

let containerCounter = 0;

/**
 * Create an isolated store container.
 *
 * @param id - Optional identifier for logs and DevTools.
 */
export function createContainer(id?: string): StoreContainer {
    const containerId = id ?? `container_${++containerCounter}`;
    const stores = new Map<string, AnyStore>();

    /**
     * Snapshots for stores that have not been created yet.
     *
     * On the client, `hydrate()` typically runs before the components that
     * resolve the stores have mounted. Holding the pending state here means
     * hydration is order-independent rather than a race the user has to win.
     */
    const pendingHydration = new Map<string, Record<string, unknown>>();
    let active = true;

    const assertActive = (op: string): void => {
        if (!active) {
            throw new Error(
                `Container "${containerId}": cannot ${op} after dispose().`,
            );
        }
    };

    /**
     * Declared as a standalone generic function rather than a method on the
     * object literal: a contextually-typed method cannot introduce its own
     * type parameters, and losing them here would erase inference for every
     * caller.
     */
    function resolve<
        S extends StateTree,
        G extends GettersTree<S>,
        A extends ActionsTree,
    >(name: string, options: StoreDefinitionOptions<S, G, A>): Store<S, G, A> {
        assertActive(`resolve store "${name}"`);

        const existing = stores.get(name);
        if (existing) {
            if (__DEV__) {
                // Two different definitions sharing a name is almost always a
                // copy-paste bug, and the symptom (one silently winning) is
                // confusing enough to be worth naming.
                const registered = definitionOf.get(existing);
                if (registered !== undefined && registered !== options) {
                    logger.warn(
                        `Container "${containerId}": store "${name}" was already created from a different definition. The first one is being reused.`,
                    );
                }
            }
            return existing as unknown as Store<S, G, A>;
        }

        const store = instantiateStore(name, options, {
            onDestroy: () => {
                stores.delete(name);
            },
        });

        definitionOf.set(store as unknown as object, options);
        stores.set(name, store as unknown as AnyStore);

        // Apply any snapshot that arrived before this store existed.
        const pending = pendingHydration.get(name);
        if (pending !== undefined) {
            pendingHydration.delete(name);
            store.$hydrate(pending as Partial<S>);
        }

        if (devtools.enabled) devtools.registerStore(name, store);
        return store;
    }

    const container: StoreContainer = {
        id: containerId,

        get active() {
            return active;
        },

        resolve,

        get(name) {
            return stores.get(name);
        },

        has(name) {
            return stores.has(name);
        },

        keys() {
            return [...stores.keys()];
        },

        dehydrate() {
            const snapshot: ContainerSnapshot = {};
            for (const [name, store] of stores) {
                snapshot[name] = store.$dehydrate() as Record<string, unknown>;
            }
            return snapshot;
        },

        hydrate(snapshot) {
            assertActive('hydrate');
            if (!snapshot || typeof snapshot !== 'object') return;

            for (const name of Object.keys(snapshot)) {
                // A snapshot crosses a serialisation boundary and is therefore
                // untrusted by the same argument as any persisted payload.
                if (!isSafeKey(name)) continue;

                const state = snapshot[name];
                if (!state || typeof state !== 'object') continue;

                const store = stores.get(name);
                if (store) {
                    store.$hydrate(state as never);
                } else {
                    pendingHydration.set(
                        name,
                        state as Record<string, unknown>,
                    );
                }
            }
        },

        dispose() {
            if (!active) return;
            active = false;
            // $destroy mutates `stores` through onDestroy, so iterate a copy.
            for (const store of [...stores.values()]) {
                try {
                    store.$destroy();
                } catch (error) {
                    if (__DEV__) {
                        logger.error(
                            `Container "${containerId}": store disposal failed: ${
                                error instanceof Error
                                    ? error.message
                                    : String(error)
                            }`,
                        );
                    }
                }
            }
            stores.clear();
            pendingHydration.clear();
        },
    };

    return container;
}

/** store instance -> the definition it was created from, for the dev warning. */
const definitionOf = new WeakMap<object, unknown>();

/* ------------------------------------------------------------------ *
 * Default container
 * ------------------------------------------------------------------ */

let defaultContainer: StoreContainer | null = null;

/**
 * The ambient container used when no explicit one is supplied.
 *
 * Created lazily so that merely importing the library allocates nothing. In a
 * browser this is the whole application; **on a server it is shared across
 * every request**, so server code must pass an explicit per-request container
 * rather than relying on this one.
 */
export function getDefaultContainer(): StoreContainer {
    if (defaultContainer === null || !defaultContainer.active) {
        defaultContainer = createContainer('default');
    }
    return defaultContainer;
}

/**
 * Replace the ambient container.
 *
 * Intended for test setup — give each test file a fresh container instead of
 * unregistering stores by hand.
 */
export function setDefaultContainer(container: StoreContainer | null): void {
    defaultContainer = container;
}

/**
 * Dispose the ambient container and start a fresh one.
 *
 * The one-call teardown for a test suite.
 */
export function resetDefaultContainer(): void {
    defaultContainer?.dispose();
    defaultContainer = null;
}
