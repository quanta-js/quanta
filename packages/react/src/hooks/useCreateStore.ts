'use client';

import { useEffect, useRef } from 'react';
import { createContainer, type StoreContainer } from '@quantajs/core';
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
 * StrictMode-safe: the double mount/unmount/remount cycle rebuilds the
 * container rather than handing back a disposed store.
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

    useEffect(() => {
        const owned = containerRef.current;
        return () => {
            owned?.dispose();
            // Cleared so a StrictMode remount builds a fresh one instead of
            // reusing the disposed container.
            containerRef.current = null;
        };
    }, [definition]);

    if (containerRef.current === null || !containerRef.current.active) {
        containerRef.current = createContainer(`local_${definition.$id}`);
    }

    return definition(containerRef.current);
}
