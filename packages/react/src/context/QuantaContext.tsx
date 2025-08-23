import { createContext, useContext } from 'react';
import type { StoreInstance } from '@quantajs/core';
import { logger } from '@quantajs/core';

export interface QuantaContextValue {
    stores: { [name: string]: StoreInstance<any, any, any> };
}

export const QuantaContext = createContext<QuantaContextValue>({ stores: {} });

/**
 * Hook to access the QuantaJS store from the context
 * @returns The store instance from the nearest QuantaProvider
 * @throws Error if used outside of QuantaProvider
 */
export function useQuantaContext(): QuantaContextValue {
    try {
        const context = useContext(QuantaContext);

        if (!context) {
            const errorMessage =
                'useQuantaContext must be used within a QuantaProvider';
            logger.error(`QuantaContext: ${errorMessage}`);
            throw new Error(errorMessage);
        }

        return context;
    } catch (error) {
        logger.error(
            `QuantaContext: Failed to access context: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
}
