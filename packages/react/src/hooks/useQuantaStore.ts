import { useSyncExternalStore } from 'react';
import type { StoreInstance } from '@quantajs/core';
import { logger } from '@quantajs/core';

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
    try {
        // Simple implementation - let QuantaJS core handle the heavy lifting
        return useSyncExternalStore(
            store.subscribe,
            () => {
                try {
                    return selector ? selector(store) : store;
                } catch (error) {
                    logger.error(
                        `useQuantaStore: Failed to get store snapshot: ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            },
            () => {
                try {
                    return selector ? selector(store) : store;
                } catch (error) {
                    logger.error(
                        `useQuantaStore: Failed to get server snapshot: ${error instanceof Error ? error.message : String(error)}`,
                    );
                    throw error;
                }
            },
        );
    } catch (error) {
        logger.error(
            `useQuantaStore: Hook execution failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
}
