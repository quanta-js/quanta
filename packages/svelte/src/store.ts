import { onDestroy } from 'svelte';
import { readable, type Readable } from 'svelte/store';
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
import { getQuantaContainer } from './context';

export interface SelectorOptions<T> {
    /**
     * Whether a new selection equals the previous one; subscribers are
     * notified only when it returns false. Defaults to `Object.is` for
     * primitives and "changed" for objects, so in-place mutation still
     * notifies. Pass `shallow` for a selector that builds a new object on
     * each run.
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

/**
 * A Svelte store holding `store`, notifying on any change to it. Svelte always
 * treats an object as changed, so setting the same store notifies.
 */
function toReadable<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(store: Store<S, G, A>): Readable<Store<S, G, A>> {
    return readable(store, (set) => store.subscribe(() => set(store)));
}

/**
 * Resolve a store definition against the container in context, falling back
 * to the default one, as a Svelte store that notifies on any change. For a
 * component that reads a slice, prefer {@link useQuantaValue}.
 *
 * @example
 * ```svelte
 * <script>
 *     const cart = useQuanta(useCartStore);
 * </script>
 *
 * {$cart.total}
 * ```
 */
export function useQuanta<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(definition: StoreDefinition<S, G, A>): Readable<Store<S, G, A>> {
    return toReadable(definition(getQuantaContainer()));
}

/**
 * A Svelte store of what `selector` reads from a store. It notifies only when
 * the state the selector read changes, and tracks the store only while it has
 * subscribers.
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
): Readable<T> {
    const store = definition(getQuantaContainer());
    const equals = options?.equalityFn ?? selectionEquals;
    return readable(
        untrack(() => selector(store)),
        (set) =>
            watch(
                () => selector(store),
                (value) => set(value),
                { immediate: true, equals },
            ),
    );
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
    return definition(getQuantaContainer());
}

/**
 * A store instance of this component's own, in a container disposed when the
 * component is destroyed. Each instance of the component gets a separate
 * store. Call it while the component initialises.
 */
export function useLocalStore<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(definition: StoreDefinition<S, G, A>): Readable<Store<S, G, A>> {
    const container = createContainer(`local_${definition.$id}`);
    onDestroy(() => container.dispose());
    return toReadable(definition(container));
}
