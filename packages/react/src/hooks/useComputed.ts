'use client';

import { useCallback, useEffect, useRef } from 'react';
import { computed, type ComputedRef } from '@quantajs/core';
import { useQuantaSelector, type SelectorOptions } from './useQuantaStore';
import type {
    ActionsTree,
    GettersTree,
    StateTree,
    Store,
} from '@quantajs/core';

/**
 * Create a cached derived value from store state and subscribe to it.
 *
 * The computed is created lazily and disposed when the component unmounts.
 *
 * ## StrictMode
 *
 * React StrictMode mounts, unmounts and remounts every component in
 * development. The render body does **not** re-run on that remount, so a hook
 * that creates its resource during render and nulls the ref in an unmount
 * cleanup is left permanently without one — the previous implementation did
 * exactly that and froze at a stale value, then threw
 * "Cannot read properties of null (reading 'value')".
 *
 * Two things make this version safe: the cleanup disposes the computed but
 * leaves the ref in place, and `ensure()` transparently rebuilds it if it was
 * disposed. Recreating is cheap — a computed is lazy until read.
 */
export function useComputed<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
    T,
>(
    store: Store<S, G, A>,
    computeFn: (store: Store<S, G, A>) => T,
    options?: SelectorOptions<T>,
): T {
    // Keep the latest compute function without recreating the computed: an
    // inline arrow is a new identity every render.
    const computeRef = useRef(computeFn);
    computeRef.current = computeFn;

    const refHolder = useRef<ComputedRef<T> | null>(null);
    const disposedRef = useRef(false);

    /** Return the live computed, rebuilding it after a StrictMode remount. */
    const ensure = useCallback((): ComputedRef<T> => {
        if (refHolder.current === null || disposedRef.current) {
            refHolder.current = computed(() => computeRef.current(store));
            disposedRef.current = false;
        }
        return refHolder.current;
    }, [store]);

    useEffect(() => {
        // Re-arm on (re)mount so the value is live again after StrictMode's
        // synthetic unmount/remount cycle.
        ensure();
        return () => {
            refHolder.current?.stop();
            disposedRef.current = true;
        };
    }, [ensure]);

    const selector = useCallback(() => ensure().value, [ensure]);
    return useQuantaSelector(store, selector, options);
}
