import { useSyncExternalStore } from 'react';
import type { StoreInstance } from '@quantajs/core';

/**
 * Hook to subscribe to a QuantaJS store and get reactive updates
 * Simple implementation that relies on QuantaJS core's reactivity system
 */
export function useQuantaStore<
    S extends object,
    G extends object,
    A extends object,
>(store: StoreInstance<S, G, A>): StoreInstance<S, G, A>;

export function useQuantaStore<
    S extends object,
    G extends object,
    A extends object,
    T = any,
>(
    store: StoreInstance<S, G, A>,
    selector: (store: StoreInstance<S, G, A>) => T,
): T;

export function useQuantaStore<
    S extends object,
    G extends object,
    A extends object,
    T = any,
>(
    store: StoreInstance<S, G, A>,
    selector?: (store: StoreInstance<S, G, A>) => T,
): StoreInstance<S, G, A> | T {
    // Simple implementation - let QuantaJS core handle the heavy lifting
    return useSyncExternalStore(
        store.subscribe,
        () => selector ? selector(store) : store,
        () => selector ? selector(store) : store,
    );
}
