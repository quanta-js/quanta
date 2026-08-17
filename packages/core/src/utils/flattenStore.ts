import {
    RawActions,
    StoreInstance,
    StoreSubscriber,
} from '../type/store-types';
import { logger } from '../services/logger-service';
import { __DEV__ } from '../utils/env';

/**
 * Internal shape the flat proxy wraps.
 */
interface StoreCore<
    S extends object,
    GDefs extends Record<string, (state: S) => unknown>,
    A extends RawActions,
> {
    state: S;
    getters: { [K in keyof GDefs]: { value: ReturnType<GDefs[K]> } };
    actions: A;
    subscribe?: (cb: StoreSubscriber) => () => void;
    $reset: () => void;
    $destroy: () => void;
}

/**
 * Present `state`, `getters` and `actions` as one flat object.
 *
 * `store.count` reads state, `store.total` reads a computed getter and
 * `store.increment()` calls an action, without the caller having to know which
 * bucket a name lives in.
 *
 * ## Resolution order: getters, then state, then actions
 *
 * `createStore` warns when a getter shadows a state key, promising that "the
 * getter takes priority on the flat store". The previous implementation
 * checked state first, so state actually won and the warning was wrong.
 *
 * Getters-first is the correct half of that contradiction to keep: a getter is
 * an explicit, intentional override written by the developer, whereas the
 * shadowed state key is reachable at `store.state.x` and the raw computed at
 * `store.getters.x`. Nothing becomes unreachable.
 */
export const flattenStore = <
    S extends object,
    GDefs extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends RawActions = RawActions,
>(
    store: StoreCore<S, GDefs, A>,
): StoreInstance<S, GDefs, A> => {
    // Declared ahead of the Proxy so the traps can reference the flat store
    // itself (getters bind to it). Without the explicit annotation TypeScript
    // cannot infer a type for a const referenced inside its own initializer.
    const flattened: StoreInstance<S, GDefs, A> = new Proxy(store, {
        get(target, prop: string | symbol, receiver) {
            // Own members of the core object (state, getters, actions,
            // subscribe, $reset, $destroy, $persist, $hydrated…) win first so
            // the store's own API can never be shadowed by a state key.
            if (Object.prototype.hasOwnProperty.call(target, prop)) {
                return Reflect.get(target, prop, receiver);
            }

            // Getters take priority over state — see the note above.
            const getters = target.getters as Record<string | symbol, unknown>;
            if (prop in getters) {
                const entry = getters[prop];
                if (
                    entry !== null &&
                    typeof entry === 'object' &&
                    'value' in entry
                ) {
                    return (entry as { value: unknown }).value;
                }
                if (typeof entry === 'function') {
                    return (entry as (...a: unknown[]) => unknown).bind(
                        flattened,
                    );
                }
                return entry;
            }

            // Reading through `target.state` (the reactive proxy) is what
            // registers the dependency, so tracking works transparently.
            if (prop in (target.state as object)) {
                return Reflect.get(target.state as object, prop);
            }

            const actions = target.actions as Record<string | symbol, unknown>;
            if (prop in actions) {
                return actions[prop];
            }

            return Reflect.get(target, prop, receiver);
        },

        set(target, prop: string | symbol, value: unknown, receiver) {
            const getters = target.getters as Record<string | symbol, unknown>;
            if (prop in getters) {
                if (__DEV__) {
                    logger.warn(
                        `Store: "${String(prop)}" is a getter and cannot be assigned. Update the state it derives from instead.`,
                    );
                }
                return true;
            }

            if (prop in (target.state as object)) {
                return Reflect.set(target.state as object, prop, value);
            }

            return Reflect.set(target, prop, value, receiver);
        },

        has(target, prop: string | symbol) {
            return (
                Object.prototype.hasOwnProperty.call(target, prop) ||
                prop in (target.getters as object) ||
                prop in (target.state as object) ||
                prop in (target.actions as object)
            );
        },

        ownKeys(target) {
            // Makes spreading and Object.keys() on the flat store return the
            // union a caller would expect, instead of the internal buckets.
            return [
                ...new Set([
                    ...Reflect.ownKeys(target.state as object),
                    ...Reflect.ownKeys(target.getters as object),
                    ...Reflect.ownKeys(target.actions as object),
                    ...Reflect.ownKeys(target),
                ]),
            ];
        },

        getOwnPropertyDescriptor(target, prop: string | symbol) {
            if (Object.prototype.hasOwnProperty.call(target, prop)) {
                return Reflect.getOwnPropertyDescriptor(target, prop);
            }
            for (const bucket of [
                target.getters as object,
                target.state as object,
                target.actions as object,
            ]) {
                if (prop in bucket) {
                    // Must be configurable: the proxy invariant check compares
                    // this against the (non-existent) own property on `target`.
                    return {
                        configurable: true,
                        enumerable: true,
                        value: (flattened as Record<string | symbol, unknown>)[
                            prop
                        ],
                    };
                }
            }
            return undefined;
        },
    }) as unknown as StoreInstance<S, GDefs, A>;

    return flattened;
};
