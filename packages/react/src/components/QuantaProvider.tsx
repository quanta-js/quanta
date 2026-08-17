'use client';

import { ReactNode, useMemo } from 'react';
import type { StoreInstance } from '@quantajs/core';
import { QuantaContext } from '../context/QuantaContext';

export interface QuantaProviderProps {
    /** Stores to expose to descendants, keyed by the name `useStore` will use. */
    stores: Record<string, StoreInstance<never, never, never>>;
    children: ReactNode;
}

/**
 * Make a set of stores available to `useStore` / `useStoreSelector` below it.
 *
 * The context value is memoised on the `stores` object. Building it inline
 * would create a new value on every render of the provider and force every
 * consumer in the tree to re-render, which is the Context fan-out problem a
 * state library exists to avoid.
 */
export function QuantaProvider({ stores, children }: QuantaProviderProps) {
    if (!stores || typeof stores !== 'object') {
        throw new Error(
            'QuantaProvider: Invalid stores prop — expected an object mapping names to store instances.',
        );
    }

    for (const [name, store] of Object.entries(stores)) {
        if (!store || typeof store !== 'object') {
            throw new Error(
                `QuantaProvider: Invalid store "${name}" — expected a store instance created with createStore().`,
            );
        }
    }

    const value = useMemo(() => ({ stores }), [stores]);

    return (
        <QuantaContext.Provider value={value}>
            {children}
        </QuantaContext.Provider>
    );
}
