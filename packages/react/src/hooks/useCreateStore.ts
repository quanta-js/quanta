import { useMemo } from 'react';
import { createStore } from '@quantajs/core';
import type {
    StateDefinition,
    GetterDefinition,
    ActionDefinition,
    StoreInstance,
} from '@quantajs/core';

/**
 * Hook to create a QuantaJS store instance within a React component
 * @param name - Unique name for the store
 * @param state - State definition function
 * @param getters - Optional getters definition
 * @param actions - Optional actions definition
 * @returns A memoized store instance
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
    return useMemo(() => {
        return createStore(name, { state, getters, actions });
    }, [name, state, getters, actions]);
}
