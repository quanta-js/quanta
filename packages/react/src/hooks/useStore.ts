'use client';

import { useQuantaContext } from '../context/QuantaContext';
import {
    useQuantaStore,
    useQuantaSelector,
    type SelectorOptions,
} from './useQuantaStore';
import type { StoreInstance, RawActions } from '@quantajs/core';

/**
 * Look a store up in the nearest {@link QuantaProvider}.
 *
 * Throws through a hook-safe path: the lookup happens before any hook is
 * called for the *missing* case only, and the hook count is otherwise
 * constant, so React's rules are not violated by a store appearing or
 * disappearing between renders.
 */
function requireStore<
    S extends object,
    GDefs extends Record<string, (state: S) => unknown>,
    A extends RawActions,
>(
    stores: Record<string, StoreInstance<never, never, never>>,
    name: string,
    hook: string,
): StoreInstance<S, GDefs, A> {
    const store = stores[name];
    if (!store) {
        throw new Error(
            `${hook}: store "${name}" is not registered on the nearest QuantaProvider. ` +
                `Available: ${Object.keys(stores).join(', ') || '(none)'}.`,
        );
    }
    return store as unknown as StoreInstance<S, GDefs, A>;
}

/**
 * Access a provided store by name and re-render on any change to it.
 *
 * Prefer {@link useStoreSelector} in components that read only a slice.
 */
export function useStore<
    S extends object,
    GDefs extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends RawActions = RawActions,
>(name: string): StoreInstance<S, GDefs, A> {
    const { stores } = useQuantaContext();
    const store = requireStore<S, GDefs, A>(stores, name, 'useStore');
    return useQuantaStore(store);
}

/**
 * Access a provided store by name and subscribe to just what the selector
 * reads.
 */
export function useStoreSelector<
    S extends object,
    GDefs extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends RawActions = RawActions,
    T = unknown,
>(
    name: string,
    selector: (store: StoreInstance<S, GDefs, A>) => T,
    options?: SelectorOptions<T>,
): T {
    const { stores } = useQuantaContext();
    const store = requireStore<S, GDefs, A>(stores, name, 'useStoreSelector');
    return useQuantaSelector(store, selector, options);
}
