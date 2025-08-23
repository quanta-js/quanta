import { ReactNode } from 'react';
import type { StoreInstance } from '@quantajs/core';
import { QuantaContext } from '../context/QuantaContext';
import { logger } from '@quantajs/core';

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
    try {
        // Validate stores object
        if (!stores || typeof stores !== 'object') {
            const errorMessage = 'QuantaProvider: Invalid stores prop provided';
            logger.error(errorMessage);
            throw new Error(errorMessage);
        }

        // Validate each store
        for (const [name, store] of Object.entries(stores)) {
            if (!store || typeof store !== 'object') {
                const errorMessage = `QuantaProvider: Invalid store "${name}" provided`;
                logger.error(errorMessage);
                throw new Error(errorMessage);
            }
        }

        return (
            <QuantaContext.Provider value={{ stores }}>
                {children}
            </QuantaContext.Provider>
        );
    } catch (error) {
        logger.error(
            `QuantaProvider: Failed to render provider: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
}
