import { useRef } from 'react';
import { createStore } from '@quantajs/core';
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
    const storeRef = useRef<StoreInstance<S, G, A>>();
    
    if (!storeRef.current) {
        storeRef.current = createStore(name, { state, getters, actions });
    }
    
    return storeRef.current;
}
