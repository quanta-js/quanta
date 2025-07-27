import { createContext, useContext } from 'react';
import type { StoreInstance } from '@quantajs/core';

export interface QuantaContextValue {
    store: StoreInstance<any, any, any>;
}

export const QuantaContext = createContext<QuantaContextValue | null>(null);

/**
 * Hook to access the QuantaJS store from the context
 * @returns The store instance from the nearest QuantaProvider
 * @throws Error if used outside of QuantaProvider
 */
export function useQuantaContext(): QuantaContextValue {
    const context = useContext(QuantaContext);

    if (!context) {
        throw new Error(
            'useQuantaContext must be used within a QuantaProvider',
        );
    }

    return context;
}
