import { useRef, useEffect } from 'react';
import { createStore, logger } from '@quantajs/core';
import type {
    StateDefinition,
    GetterDefinitions,
    ActionDefinition,
    StoreInstance,
} from '@quantajs/core';

/**
 * Hook to create a QuantaJS store instance within a React component.
 * Creates store only once and cleans up on unmount.
 */
export function useCreateStore<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends Record<string, (...args: any[]) => any> = {},
>(
    name: string,
    state: StateDefinition<S>,
    getters?: GetterDefinitions<S, GDefs>,
    actions?: ActionDefinition<S, GDefs, A>,
): StoreInstance<S, GDefs, A> {
    const storeRef = useRef<StoreInstance<S, GDefs, A> | undefined>(undefined);

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

    // Cleanup on unmount — destroys store and deregisters from registry
    useEffect(() => {
        return () => {
            storeRef.current?.$destroy?.();
        };
    }, []);

    return storeRef.current;
}
