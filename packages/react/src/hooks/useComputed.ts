import { useRef } from 'react';
import { computed } from '@quantajs/core';
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
    const computedRef = useRef<{ value: T } | null>(null);
    
    if (!computedRef.current) {
        computedRef.current = computed(() => computeFn(store));
    }

    return useQuantaStore(store, () => computedRef.current!.value);
}
