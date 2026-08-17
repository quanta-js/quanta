'use client';

import { createContext, useContext } from 'react';
import type { StoreContainer } from '@quantajs/core';

export interface QuantaContextValue {
    /** The container every store below this provider resolves against. */
    container: StoreContainer;
}

// null default so "used outside a provider" is detectable.
export const QuantaContext = createContext<QuantaContextValue | null>(null);

/**
 * The nearest {@link QuantaProvider}'s context.
 *
 * @throws if used outside a provider.
 */
export function useQuantaContext(): QuantaContextValue {
    const context = useContext(QuantaContext);
    if (context === null) {
        throw new Error(
            'useQuantaContext must be used within a <QuantaProvider>. ' +
                'Wrap your tree with <QuantaProvider container={createContainer()}>.',
        );
    }
    return context;
}

/**
 * The container from the nearest provider, or the ambient one when there is no
 * provider.
 *
 * Client-only apps can skip the provider entirely; server-rendered apps must
 * supply one, because the ambient container is shared across requests.
 */
export function useContainerOrDefault(): StoreContainer | undefined {
    return useContext(QuantaContext)?.container;
}
