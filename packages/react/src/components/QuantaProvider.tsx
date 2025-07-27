import { ReactNode } from 'react';
import type { StoreInstance } from '@quantajs/core';
import { QuantaContext } from '../context/QuantaContext';

export interface QuantaProviderProps {
    store: StoreInstance<any, any, any>;
    children: ReactNode;
}

/**
 * Provider component that makes a QuantaJS store available to all child components
 * @param store - The QuantaJS store instance to provide
 * @param children - Child components that can access the store
 */
export function QuantaProvider({ store, children }: QuantaProviderProps) {
    return (
        <QuantaContext.Provider value={{ store }}>
            {children}
        </QuantaContext.Provider>
    );
}
