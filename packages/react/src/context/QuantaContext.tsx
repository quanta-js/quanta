'use client';

import { createContext, useContext } from 'react';
import type { StoreInstance } from '@quantajs/core';

export interface QuantaContextValue {
    stores: Record<string, StoreInstance<never, never, never>>;
}

// Use null default so we can detect when used outside a Provider
export const QuantaContext = createContext<QuantaContextValue | null>(null);

/**
 * Hook to access the QuantaJS store from the context
 * @returns The store instance from the nearest QuantaProvider
 * @throws Error if used outside of QuantaProvider
 */
export function useQuantaContext(): QuantaContextValue {
    const context = useContext(QuantaContext);

    if (context === null) {
        throw new Error(
            'useQuantaContext must be used within a QuantaProvider. ' +
                'Wrap your component tree with <QuantaProvider stores={…}>.',
        );
    }

    return context;
}
