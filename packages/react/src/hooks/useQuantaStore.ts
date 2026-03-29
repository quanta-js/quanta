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
 * Hook to subscribe to a QuantaJS store and get reactive updates on any store change.
 * This returns the full store instance.
 *
 * @param store - The QuantaJS store instance
 * @returns The store instance
 */
export function useQuantaStore<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
>(store: StoreInstance<S, GDefs, A>): StoreInstance<S, GDefs, A> {
    if (!store.subscribe) {
        const err = new Error(
            'QuantaJS store missing `subscribe`—ensure core v0.1.0-beta.2+.',
        );
        logger.error(`useQuantaStore: ${err.message}`);
        throw err;
    }

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

/**
 * Hook to subscribe to a specific part of a QuantaJS store.
 * Only re-renders when the selected value changes.
 *
 * @param store - The QuantaJS store instance
 * @param selector - Selector function to pick state from the store
 * @returns The selected value
 */
export function useQuantaSelector<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
    T = unknown,
>(
    store: StoreInstance<S, GDefs, A>,
    selector: (store: StoreInstance<S, GDefs, A>) => T,
): T {
    if (!store.subscribe) {
        const err = new Error(
            'QuantaJS store missing `subscribe`—ensure core v0.1.0-beta.2+.',
        );
        logger.error(`useQuantaSelector: ${err.message}`);
        throw err;
    }

    const selectedRef = useRef<T | typeof UNSET>(UNSET);
    const selectorRef = useRef(selector);
    const storeRef = useRef(store);

    if (selectorRef.current !== selector || storeRef.current !== store) {
        selectorRef.current = selector;
        storeRef.current = store;
        selectedRef.current = UNSET;
    }

    const getInitialSelected = useCallback(() => {
        const initial = selector(store);
        selectedRef.current = initial;
        return initial;
    }, [store, selector]);

    const subscribe = useCallback(
        (cb: () => void) => {
            const coreCb: StoreSubscriber<S> = () => {
                try {
                    const freshSelected = selector(store);
                    if (!Object.is(selectedRef.current, freshSelected)) {
                        selectedRef.current = freshSelected;
                        cb();
                    }
                } catch (error) {
                    logger.warn(
                        `useQuantaSelector: Selector update failed: ${String(error)}`,
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
