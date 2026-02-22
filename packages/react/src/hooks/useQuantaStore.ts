import { useCallback, useRef, useSyncExternalStore } from 'react';
import type {
    RawActions,
    StoreInstance,
    StoreSubscriber,
} from '@quantajs/core';
import { logger } from '@quantajs/core';

/** Sentinel to distinguish "not yet initialized" from legitimate `null` */
const UNSET = Symbol('unset');

/**
 * Hook to subscribe to a QuantaJS store and get reactive updates.
 * Uses useSyncExternalStore for concurrent-safe React integration.
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
        // No selector: use version counter to signal React that store changed,
        // then return the store proxy directly (avoids rebuilding snapshot objects)
        const versionRef = useRef(0);

        const subscribe = useCallback(
            (cb: () => void) => {
                const coreCb: StoreSubscriber<S> = () => {
                    versionRef.current++;
                    cb(); // Signal React to re-render
                };
                return store.subscribe(coreCb);
            },
            [store],
        );

        const getSnapshot = useCallback(() => versionRef.current, []);

        // Subscribe to changes using version counter
        useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

        // Return the live store proxy — React re-renders when version changes
        return store;
    }

    // Selector branch: only re-render when selected value changes
    const selectedRef = useRef<T | typeof UNSET>(UNSET);

    const getInitialSelected = useCallback(() => {
        const initial = selector!(store);
        selectedRef.current = initial;
        return initial;
    }, [store, selector]);

    const subscribe = useCallback(
        (cb: () => void) => {
            const coreCb: StoreSubscriber<S> = () => {
                try {
                    const freshSelected = selector!(store);
                    if (!Object.is(selectedRef.current, freshSelected)) {
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
        if (selectedRef.current === UNSET) {
            getInitialSelected();
        }
        return selectedRef.current as T;
    }, [getInitialSelected]);

    const getServerSnapshot = useCallback(
        () => getInitialSelected(),
        [getInitialSelected],
    );

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
