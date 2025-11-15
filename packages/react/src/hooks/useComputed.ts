import { useRef } from 'react';
import { computed, logger } from '@quantajs/core';
import { useQuantaStore } from './useQuantaStore';
import type { RawActions, StoreInstance } from '@quantajs/core';

/**
 * Hook to create and use computed values that depend on store state
 * @param store - The QuantaJS store instance
 * @param computeFn - Function that computes a value based on the store
 * @returns The computed value that updates reactively
 */
export function useComputed<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
    T = any,
>(
    store: StoreInstance<S, GDefs, A>,
    computeFn: (store: StoreInstance<S, GDefs, A>) => T,
): T {
    try {
        const computedRef = useRef<{ value: T } | null>(null);

        if (!computedRef.current) {
            computedRef.current = computed(() => computeFn(store));
        }

        return useQuantaStore(store, () => computedRef.current!.value);
    } catch (error) {
        logger.error(
            `useComputed: Hook execution failed: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        throw error;
    }
}
