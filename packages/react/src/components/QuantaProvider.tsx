import { ReactNode } from 'react';
import type { StoreInstance } from '@quantajs/core';
import { QuantaContext } from '../context/QuantaContext';

export interface QuantaProviderProps {
    stores: { [key: string]: StoreInstance<any, any, any> };
    children: ReactNode;
}

/**
 * Provider component that makes a QuantaJS store available to all child components
 * @param stores - The QuantaJS stores instances to provide
 * @param children - Child components that can access the stores
 */
export function QuantaProvider({ stores, children }: QuantaProviderProps) {
    return (
        <QuantaContext.Provider value={{ stores }}>
            {children}
        </QuantaContext.Provider>
    );
}
