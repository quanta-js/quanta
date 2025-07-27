import { useSyncExternalStore, useCallback } from 'react';
import type { StoreInstance } from '@quantajs/core';

/**
 * Hook to subscribe to a QuantaJS store and get reactive updates
 * @param store - The QuantaJS store instance to subscribe to
 * @param selector - Optional selector function to pick specific parts of the store
 * @returns The store instance or selected value that updates reactively
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
    const getSnapshot = useCallback(() => {
        if (selector) {
            return selector(store);
        }
        return store;
    }, [store, selector]);

    const subscribe = useCallback(
        (callback: () => void) => {
            return store.subscribe(callback);
        },
        [store],
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
