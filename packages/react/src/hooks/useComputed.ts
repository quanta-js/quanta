import { useRef } from 'react';
import { computed, logger } from '@quantajs/core';
import { useQuantaStore } from './useQuantaStore';
import type { StoreInstance } from '@quantajs/core';

/**
 * Hook to create and use computed values that depend on store state
 * @param store - The QuantaJS store instance
 * @param computeFn - Function that computes a value based on the store
 * @returns The computed value that updates reactively
 */
export function useComputed<
    S extends object,
    G extends object,
    A extends object,
    T,
>(
    store: StoreInstance<S, G, A>,
    computeFn: (store: StoreInstance<S, G, A>) => T,
): T {
    try {
        const computedRef = useRef<{ value: T } | null>(null);

        if (!computedRef.current) {
            try {
                computedRef.current = computed(() => computeFn(store));
            } catch (error) {
                logger.error(
                    `useComputed: Failed to create computed value: ${error instanceof Error ? error.message : String(error)}`,
                );
                throw error;
            }
        }

        return useQuantaStore(store, () => {
            try {
                return computedRef.current!.value;
            } catch (error) {
                logger.error(
                    `useComputed: Failed to get computed value: ${error instanceof Error ? error.message : String(error)}`,
                );
                throw error;
            }
        });
    } catch (error) {
        logger.error(
            `useComputed: Hook execution failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
}
