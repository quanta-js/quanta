import { useQuantaContext } from '../context/QuantaContext';
import { useQuantaStore } from './useQuantaStore';
import type { StoreInstance } from '@quantajs/core';

/**
 * Hook to access and subscribe to the QuantaJS store from context
 * @param selector - Optional selector function to pick specific parts of the store
 * @returns The store instance or selected value that updates reactively
 */
export function useStore<T = any>(
    selector?: (store: StoreInstance<any, any, any>) => T,
): T extends undefined ? StoreInstance<any, any, any> : T {
    const { store } = useQuantaContext();

    if (selector) {
        return useQuantaStore(store, selector) as T extends undefined
            ? StoreInstance<any, any, any>
            : T;
    }

    return useQuantaStore(store) as T extends undefined
        ? StoreInstance<any, any, any>
        : T;
}
