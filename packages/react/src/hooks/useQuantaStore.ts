import { useCallback, useRef, useSyncExternalStore } from 'react';
import type {
    RawActions,
    StoreInstance,
    StoreSubscriber,
} from '@quantajs/core';
import { logger } from '@quantajs/core';
import { resolveGetterValue } from '../utils/resolve-getters';

/**
 * Hook to subscribe to a QuantaJS store and get reactive updates
 * Simple implementation that relies on QuantaJS core's reactivity system
 */
// 1) No selector → return full store instance
export function useQuantaStore<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
>(store: StoreInstance<S, GDefs, A>): StoreInstance<S, GDefs, A>;

// 2) Selector provided → return T
export function useQuantaStore<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
    T = any,
>(
    store: StoreInstance<S, GDefs, A>,
    selector: (store: StoreInstance<S, GDefs, A>) => T,
): T;

// 3) Implementation
export function useQuantaStore<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
    T = any,
>(
    store: StoreInstance<S, GDefs, A>,
    selector?: (store: StoreInstance<S, GDefs, A>) => T,
): StoreInstance<S, GDefs, A> | T {
    if (!store.subscribe) {
        const err = new Error(
            'QuantaJS store missing `subscribe`—ensure core v0.1.0-beta.2+.',
        );
        logger.error(`useQuantaStore: ${err.message}`);
        throw err;
    }

    if (!selector) {
        // Snapshot embeds live Proxies (reactive nests), invalidates on notify
        const snapshotRef = useRef<StoreInstance<S, GDefs, A> | null>(null);

        const getSnapshot = useCallback(() => {
            if (snapshotRef.current) return snapshotRef.current;

            // Build from original flattened (queries get traps -> embeds Proxies for nests)
            const snap: any = {};
            // State props (reactive via get trap)
            Object.keys(store.state || {}).forEach((key) => {
                snap[key] = (store as any)[key];
            });
            // Getters (live resolve)
            Object.keys(store.getters || {}).forEach((key) => {
                const getter = (store as any).getters[key];
                snap[key] = resolveGetterValue(getter, store);
            });
            // Actions (stable bind)
            Object.keys(store.actions || {}).forEach((key) => {
                snap[key] = (store.actions as any)[key].bind(store);
            });
            // Helpers
            snap.$reset = store.$reset;
            snap.$persist = store.$persist;
            snap.$destroy = store.$destroy;

            snapshotRef.current = snap as StoreInstance<S, GDefs, A>;
            return snap;
        }, [store]);

        const subscribe = useCallback(
            (cb: () => void) => {
                const coreCb: StoreSubscriber<S> = (_stateSnap?: S) => {
                    snapshotRef.current = null; // Invalidate for fresh build on next getSnapshot
                    cb(); // Mark dirty for re-render
                };
                return store.subscribe(coreCb);
            },
            [store],
        );

        const getServerSnapshot = useCallback(
            () => getSnapshot(),
            [getSnapshot],
        );

        return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    }

    // Selector branch: Unchanged (queries original, conditional re-render)
    const selectedRef = useRef<T | null>(null);
    const getInitialSelected = useCallback(() => {
        const initial = selector!(store); // Non-null assertion (selector present)
        selectedRef.current = initial;
        return initial;
    }, [store, selector]);

    const subscribe = useCallback(
        (cb: () => void) => {
            const coreCb: StoreSubscriber<S> = (_stateSnap?: S) => {
                try {
                    const freshSelected = selector!(store);
                    if (selectedRef.current !== freshSelected) {
                        selectedRef.current = freshSelected;
                        cb();
                    }
                } catch (error) {
                    logger.warn(
                        `useQuantaStore: Selector update failed: ${String(error)}`,
                    );
                }
            };
            return store.subscribe(coreCb);
        },
        [store, selector],
    );

    const getSnapshot = useCallback(() => {
        if (selectedRef.current === null) {
            getInitialSelected();
        }
        return selectedRef.current!;
    }, [getInitialSelected]);

    const getServerSnapshot = useCallback(
        () => getInitialSelected(),
        [getInitialSelected],
    );

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
