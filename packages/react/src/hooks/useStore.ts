import { useQuantaContext } from '../context/QuantaContext';
import { useQuantaStore, useQuantaSelector } from './useQuantaStore';
import type { StoreInstance, RawActions } from '@quantajs/core';
import { logger } from '@quantajs/core';

/**
 * Hook to access and subscribe to a QuantaJS store from context by name.
 *
 * @param name - The name of the store
 * @returns The store instance with reactivity
 */
export function useStore<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
>(name: string): StoreInstance<S, GDefs, A> {
    try {
        const { stores } = useQuantaContext();
        const store = stores[name];
        if (!store) {
            const errorMessage = `Store with name "${name}" does not exist in the context.`;
            logger.error(`useStore: ${errorMessage}`);
            throw new Error(errorMessage);
        }
        return useQuantaStore(store as StoreInstance<S, GDefs, A>);
    } catch (error) {
        logger.error(
            `useStore: Failed to access store "${name}": ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
}

/**
 * Hook to select and subscribe to a specific part of a store from context.
 *
 * @param name - The name of the store
 * @param selector - Selector function to pick state from the store
 * @returns The selected value
 */
export function useStoreSelector<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
    T = unknown,
>(name: string, selector: (store: StoreInstance<S, GDefs, A>) => T): T {
    try {
        const { stores } = useQuantaContext();
        const store = stores[name];
        if (!store) {
            const errorMessage = `Store with name "${name}" does not exist in the context.`;
            logger.error(`useStoreSelector: ${errorMessage}`);
            throw new Error(errorMessage);
        }
        return useQuantaSelector(store as StoreInstance<S, GDefs, A>, selector);
    } catch (error) {
        logger.error(
            `useStoreSelector: Failed to access store "${name}": ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
}
