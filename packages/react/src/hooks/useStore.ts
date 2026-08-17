'use client';

import { useContainerOrDefault } from '../context/QuantaContext';
import {
    useQuantaStore,
    useQuantaSelector,
    type SelectorOptions,
} from './useQuantaStore';
import type {
    ActionsTree,
    GettersTree,
    StateTree,
    Store,
    StoreDefinition,
} from '@quantajs/core';

/**
 * Resolve a store definition against the nearest provider's container, falling
 * back to the ambient one.
 *
 * This is the hook to reach for: it is fully typed from the definition, and it
 * picks up a per-request container automatically under SSR.
 *
 * @example
 * ```tsx
 * const cart = useQuanta(useCartStore);
 * return <span>{cart.total}</span>;
 * ```
 */
export function useQuanta<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(definition: StoreDefinition<S, G, A>): Store<S, G, A> {
    const container = useContainerOrDefault();
    const store = definition(container);
    return useQuantaStore(store);
}

/**
 * Resolve a store definition and subscribe to only what the selector reads.
 *
 * @example
 * ```tsx
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
): T {
    const container = useContainerOrDefault();
    const store = definition(container);
    return useQuantaSelector(store, selector, options);
}

/**
 * Resolve a store definition without subscribing to it.
 *
 * Use when a component only calls actions and never reads state — it avoids
 * re-rendering that component on every change.
 */
export function useQuantaActions<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(definition: StoreDefinition<S, G, A>): Store<S, G, A> {
    const container = useContainerOrDefault();
    return definition(container);
}
