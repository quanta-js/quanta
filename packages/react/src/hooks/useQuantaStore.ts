import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { StoreInstance, StoreSubscriber } from '@quantajs/core';
import { logger } from '@quantajs/core';

/**
 * Hook to subscribe to a QuantaJS store and get reactive updates
 * Simple implementation that relies on QuantaJS core's reactivity system
 */
export function useQuantaStore<
    S extends object,
    G extends object,
    A extends object,
>(store: StoreInstance<S, G, A>): StoreInstance<S, G, A>;

export function useQuantaStore<
    S extends object,
    G extends object,
    A extends object,
    T = any,
>(
    store: StoreInstance<S, G, A>,
    selector: (store: StoreInstance<S, G, A>) => T,
): T;

export function useQuantaStore<
    S extends object,
    G extends object,
    A extends object,
    T = any,
>(
    store: StoreInstance<S, G, A>,
    selector?: (store: StoreInstance<S, G, A>) => T,
): StoreInstance<S, G, A> | T {
    // Guard: Core subscribe required (per beta.2+)
    if (!store.subscribe) {
        const err = new Error(
            'QuantaJS store missing `subscribe`—ensure core v0.1.0-beta.2+.',
        );
        logger.error(`useQuantaStore: ${err.message}`);
        throw err;
    }

    // Cache: Holds current flat snapshot (stable ref until mutation)
    const snapshotRef = useRef<StoreInstance<S, G, A> | null>(null);

    // Initial cache: Flat { state props, actions } (shallow, stable actions)
    const getInitialSnapshot = useCallback(() => {
        const stateSnap = store.state ?? {}; // Fallback for empty initial
        const snap: any = { ...stateSnap };
        // Merge stable actions (bound to original for mutations)
        Object.keys(store.actions ?? {}).forEach((key) => {
            snap[key] = (store.actions as any)[key].bind(store);
        });
        // Add getters if computed (flat access)
        if ((store as any).getters) {
            Object.keys((store as any).getters).forEach((key) => {
                const getter = (store as any).getters[key];
                snap[key] =
                    typeof getter === 'function' ? getter.bind(store) : getter;
            });
        }
        return snap as StoreInstance<S, G, A>;
    }, [store]);

    if (snapshotRef.current === null) {
        snapshotRef.current = getInitialSnapshot();
    }

    // Sub: Listen to core notify, update cache with fresh state + stable actions, mark dirty
    const subscribe = useCallback(
        (cb: () => void) => {
            // Core cb: Receives state snap from notifyAll
            const coreCb: StoreSubscriber<S> = (stateSnap?: S) => {
                try {
                    const freshState = stateSnap ?? store.state ?? {};
                    const newSnap: any = { ...freshState };
                    // Stable actions/getters (no rebinds—original bindings persist)
                    Object.keys(store.actions ?? {}).forEach((key) => {
                        newSnap[key] = (store.actions as any)[key];
                    });
                    if ((store as any).getters) {
                        Object.keys((store as any).getters).forEach((key) => {
                            const getter = (store as any).getters[key];
                            newSnap[key] =
                                typeof getter === 'function'
                                    ? getter.bind(store)
                                    : getter;
                        });
                    }
                    snapshotRef.current = newSnap as StoreInstance<S, G, A>;
                    cb(); // Mark dirty for React
                } catch (error) {
                    logger.warn(
                        `useQuantaStore: Failed to update snapshot: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            };
            return store.subscribe(coreCb);
        },
        [store],
    );

    // Snapshot: Return cached (stable until updated) or selector-applied
    const getSnapshot = useCallback(() => {
        try {
            if (!snapshotRef.current) {
                snapshotRef.current = getInitialSnapshot();
            }
            return selector
                ? selector(snapshotRef.current)
                : snapshotRef.current;
        } catch (error) {
            logger.error(
                `useQuantaStore: getSnapshot failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }, [selector, getInitialSnapshot]);

    // Server snapshot: Initial only (no subs/mutations)
    const getServerSnapshot = useCallback(() => {
        try {
            const initial = getInitialSnapshot();
            return selector ? selector(initial) : initial;
        } catch (error) {
            logger.error(
                `useQuantaStore: getServerSnapshot failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }, [selector, getInitialSnapshot]);

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
