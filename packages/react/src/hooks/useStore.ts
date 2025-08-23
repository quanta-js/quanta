import { useQuantaContext } from '../context/QuantaContext';
import { useQuantaStore } from './useQuantaStore';
import type { StoreInstance } from '@quantajs/core';
import { logger } from '@quantajs/core';

/**
 * Hook to access and subscribe to the QuantaJS store from context
 * @param name - The name of the store to access
 * @param selector - Optional selector function to pick specific parts of the store
 * @returns The store instance or selected value that updates reactively
 */
export function useStore<T = any>(
    name: string,
    selector?: (store: StoreInstance<any, any, any>) => T,
): T extends undefined ? StoreInstance<any, any, any> : T {
    try {
        const { stores } = useQuantaContext();
        const store = stores[name];
        if (!store) {
            const errorMessage = `Store with name "${name}" does not exist in the context.`;
            logger.error(`useStore: ${errorMessage}`);
            throw new Error(errorMessage);
        }
        if (selector) {
            return useQuantaStore(store, selector) as T extends undefined
                ? StoreInstance<any, any, any>
                : T;
        }

        return useQuantaStore(store) as T extends undefined
            ? StoreInstance<any, any, any>
            : T;
    } catch (error) {
        logger.error(
            `useStore: Failed to access store "${name}": ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
}
