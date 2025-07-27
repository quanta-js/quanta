import { useMemo } from 'react';
import { computed } from '@quantajs/core';
import { useQuantaStore } from './useQuantaStore';
import type { StoreInstance } from '@quantajs/core';

/**
 * Hook to create and use computed values that depend on store state
 * @param store - The QuantaJS store instance
 * @param computeFn - Function that computes a value based on the store
 * @param deps - Optional dependency array for memoization
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
    deps?: React.DependencyList,
): T {
    const computedValue = useMemo(
        () => {
            return computed(() => computeFn(store));
        },
        deps ? [store, ...deps] : [store, computeFn],
    );

    return useQuantaStore(store, () => computedValue.value);
}
