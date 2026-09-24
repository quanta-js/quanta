import {
    getCurrentScope,
    onScopeDispose,
    shallowRef,
    triggerRef,
    type Ref,
} from 'vue';
import {
    createContainer,
    untrack,
    watch,
    type ActionsTree,
    type GettersTree,
    type StateTree,
    type Store,
    type StoreDefinition,
} from '@quantajs/core';
import { useQuantaContainer } from './container';

export interface SelectorOptions<T> {
    /**
     * Whether a new selection equals the previous one; the ref updates only
     * when it returns false. Defaults to `Object.is` for primitives and
     * "changed" for objects, so in-place mutation still updates. Pass
     * `shallow` for a selector that builds a new object on each run.
     */
    equalityFn?: (a: T, b: T) => boolean;
}

/**
 * Only re-evaluated because something the selector read changed, so an object
 * that is still the same identity has been mutated in place.
 */
function selectionEquals<T>(a: T, b: T): boolean {
    if (typeof a === 'object' && a !== null) return false;
    if (typeof b === 'object' && b !== null) return false;
    return Object.is(a, b);
}

/** No updates are rendered on the server, so nothing subscribes there. */
const isServer = (): boolean => typeof window === 'undefined';

/** Stop with the current component or effect scope. */
function onDispose(stop: () => void): void {
    if (getCurrentScope()) onScopeDispose(stop);
}

/**
 * Wrap a store so Vue tracks it: reading any key through the wrapper makes the
 * current render depend on the whole store.
 */
function track<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(store: Store<S, G, A>): Store<S, G, A> {
    const version = shallowRef(0);
    if (!isServer()) {
        onDispose(
            store.subscribe(() => {
                version.value++;
            }),
        );
    }
    return new Proxy(store, {
        get(target, key, receiver) {
            // Vue's marker for objects it must not make reactive: the store has
            // its own reactivity, and a Vue proxy around it would break it.
            if (key === '__v_skip') return true;
            void version.value;
            return Reflect.get(target, key, receiver);
        },
    });
}

/**
 * Resolve a store definition against the provided container, falling back to
 * the default one. The component re-renders on any change to the store; for a
 * component that reads a slice, prefer {@link useQuantaValue}.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const cart = useQuanta(useCartStore);
 * </script>
 *
 * <template>{{ cart.total }}</template>
 * ```
 */
export function useQuanta<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(definition: StoreDefinition<S, G, A>): Store<S, G, A> {
    return track(definition(useQuantaContainer()));
}

/**
 * A ref to what `selector` reads from a store. It updates only when the state
 * the selector read changes, so components stay independent of the rest of the
 * store.
 *
 * @example
 * ```ts
 * const count = useQuantaValue(useCartStore, (s) => s.items.length);
 * ```
 */
export function useQuantaValue<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
    T,
>(
    definition: StoreDefinition<S, G, A>,
    selector: (store: Store<S, G, A>) => T,
    options?: SelectorOptions<T>,
): Readonly<Ref<T>> {
    const store = definition(useQuantaContainer());
    if (isServer()) return shallowRef(untrack(() => selector(store)));

    const value = shallowRef() as Ref<T>;
    onDispose(
        watch(
            () => selector(store),
            (next) => {
                // A mutated object keeps its identity, which a ref ignores.
                if (Object.is(value.value, next)) triggerRef(value);
                else value.value = next;
            },
            {
                immediate: true,
                equals: options?.equalityFn ?? selectionEquals,
            },
        ),
    );
    return value;
}

/**
 * Resolve a store definition without subscribing to it, for components that
 * only call actions.
 */
export function useQuantaActions<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(definition: StoreDefinition<S, G, A>): Store<S, G, A> {
    return definition(useQuantaContainer());
}

/**
 * A store instance of this component's own, in a container that is disposed
 * when the component unmounts. Each instance of the component gets a separate
 * store. Re-renders on any change, like {@link useQuanta}.
 */
export function useLocalStore<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(definition: StoreDefinition<S, G, A>): Store<S, G, A> {
    const container = createContainer(`local_${definition.$id}`);
    onDispose(() => container.dispose());
    return track(definition(container));
}
