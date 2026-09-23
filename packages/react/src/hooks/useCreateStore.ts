'use client';

import { useRef } from 'react';
import { createContainer, type StoreContainer } from '@quantajs/core';
import { useDisposeOnUnmount } from './useDisposeOnUnmount';
import type {
    ActionsTree,
    GettersTree,
    StateTree,
    Store,
    StoreDefinition,
} from '@quantajs/core';

/**
 * Create a store whose lifetime is tied to a single component instance.
 *
 * Each mount gets its **own container**, so two instances of the component do
 * not share state and neither leaks into the ambient container. The container
 * is disposed on unmount, which releases every effect, watcher and persistence
 * subscription the store owns.
 *
 * StrictMode-safe: the simulated unmount in development does not dispose the
 * container the component is still using.
 *
 * @example
 * ```tsx
 * const wizard = useLocalStore(wizardStoreDefinition);
 * ```
 */
export function useLocalStore<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
>(definition: StoreDefinition<S, G, A>): Store<S, G, A> {
    const containerRef = useRef<StoreContainer | null>(null);
    if (containerRef.current === null || !containerRef.current.active) {
        containerRef.current = createContainer(`local_${definition.$id}`);
    }
    const container = containerRef.current;

    useDisposeOnUnmount(container);

    return definition(container);
}
