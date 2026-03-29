import { useEffect, useRef } from 'react';
import { computed, logger } from '@quantajs/core';
import { useQuantaSelector } from './useQuantaStore';
import type { RawActions, StoreInstance } from '@quantajs/core';

/**
 * Hook to create and use computed values that depend on store state.
 * Automatically disposes of the internal computed effect on unmount.
 *
 * @param store - The QuantaJS store instance
 * @param computeFn - Function that computes a value based on the store
 * @returns The computed value that updates reactively
 */
export function useComputed<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
    T = unknown,
>(
    store: StoreInstance<S, GDefs, A>,
    computeFn: (store: StoreInstance<S, GDefs, A>) => T,
): T {
    const computedRef = useRef<ReturnType<typeof computed<T>> | null>(null);

    if (!computedRef.current) {
        try {
            computedRef.current = computed(() => computeFn(store));
        } catch (error) {
            logger.error(
                `useComputed: Failed to initialize computed: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            throw error;
        }
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (
                computedRef.current &&
                typeof (computedRef.current as any).stop === 'function'
            ) {
                (computedRef.current as any).stop();
                computedRef.current = null;
            }
        };
    }, []);

    try {
        // Only re-render when the computed value itself changes
        return useQuantaSelector(store, () => computedRef.current!.value);
    } catch (error) {
        logger.error(
            `useComputed: Hook execution failed: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        throw error;
    }
}
