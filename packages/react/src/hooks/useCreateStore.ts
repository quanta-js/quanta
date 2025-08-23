import { useRef } from 'react';
import { createStore, logger } from '@quantajs/core';
import type {
    StateDefinition,
    GetterDefinition,
    ActionDefinition,
    StoreInstance,
} from '@quantajs/core';

/**
 * Hook to create a QuantaJS store instance within a React component
 * Creates store only once and reuses it across re-renders
 */
export function useCreateStore<
    S extends object,
    G extends object = {},
    A extends Record<string, (...args: any[]) => any> = {},
>(
    name: string,
    state: StateDefinition<S>,
    getters?: GetterDefinition<S, G>,
    actions?: ActionDefinition<S, G, A>,
): StoreInstance<S, G, A> {
    try {
        const storeRef = useRef<StoreInstance<S, G, A> | undefined>(undefined);

        if (!storeRef.current) {
            try {
                storeRef.current = createStore(name, {
                    state,
                    getters,
                    actions,
                });
            } catch (error) {
                logger.error(
                    `useCreateStore: Failed to create store "${name}": ${error instanceof Error ? error.message : String(error)}`,
                );
                throw error;
            }
        }

        return storeRef.current;
    } catch (error) {
        logger.error(
            `useCreateStore: Hook execution failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
}
