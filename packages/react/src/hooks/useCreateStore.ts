'use client';

import { useRef, useEffect } from 'react';
import { getOrCreateStore } from '@quantajs/core';
import type {
    StateDefinition,
    GetterDefinitions,
    ActionDefinition,
    StoreInstance,
    RawActions,
} from '@quantajs/core';

/**
 * Create (or reuse) a named store scoped to a component's lifetime.
 *
 * Uses `getOrCreateStore` rather than `createStore` so that React StrictMode's
 * double-mount, hot-module replacement and repeated test setup all reuse the
 * existing instance instead of throwing on a duplicate name.
 *
 * The store is destroyed on unmount. Because StrictMode unmounts and remounts,
 * the ref is cleared alongside the destroy so the next mount rebuilds rather
 * than handing back a disposed store.
 */
export function useCreateStore<
    S extends object,
    GDefs extends Record<string, (state: S) => unknown> = Record<
        string,
        (state: S) => unknown
    >,
    A extends RawActions = RawActions,
>(
    name: string,
    state: StateDefinition<S>,
    getters?: GetterDefinitions<S, GDefs>,
    actions?: ActionDefinition<S, GDefs, A>,
): StoreInstance<S, GDefs, A> {
    const storeRef = useRef<StoreInstance<S, GDefs, A> | null>(null);

    if (storeRef.current === null) {
        storeRef.current = getOrCreateStore<S, GDefs, A>(name, {
            state,
            getters,
            actions,
        });
    }

    useEffect(() => {
        // Re-acquire in case a previous StrictMode cycle destroyed it.
        storeRef.current = getOrCreateStore<S, GDefs, A>(name, {
            state,
            getters,
            actions,
        });
        return () => {
            storeRef.current?.$destroy();
            storeRef.current = null;
        };
        // Intentionally keyed on `name` alone: the option callbacks are
        // re-created every render, but the store's identity is its name.
    }, [name]);

    return storeRef.current;
}
