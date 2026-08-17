'use client';

import { useEffect, useRef } from 'react';
import { watch, logger } from '@quantajs/core';
import type {
    ActionsTree,
    GettersTree,
    StateTree,
    Store,
} from '@quantajs/core';

/**
 * Hook to watch for changes in store values and execute side effects
 * @param store - The QuantaJS store instance
 * @param watchFn - Function that returns the value to watch
 * @param callback - Callback to execute when the watched value changes
 */
export function useWatch<
    S extends StateTree,
    G extends GettersTree<S>,
    A extends ActionsTree,
    T,
>(
    store: Store<S, G, A>,
    watchFn: (store: Store<S, G, A>) => T,
    callback: (newValue: T) => void,
    options?: { deep?: boolean; immediate?: boolean },
): void {
    // Stabilize callback and watchFn with refs to avoid effect re-runs on every render
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    const watchFnRef = useRef(watchFn);
    watchFnRef.current = watchFn;
    const deep = options?.deep ?? false;
    const immediate = options?.immediate ?? false;

    useEffect(() => {
        try {
            const cleanup = watch(
                () => {
                    try {
                        return watchFnRef.current(store);
                    } catch (error) {
                        logger.error(
                            `useWatch: Failed to execute watch function: ${error instanceof Error ? error.message : String(error)}`,
                        );
                        throw error;
                    }
                },
                (newValue: T) => {
                    try {
                        callbackRef.current(newValue);
                    } catch (error) {
                        logger.error(
                            `useWatch: Failed to execute watch callback: ${error instanceof Error ? error.message : String(error)}`,
                        );
                        throw error;
                    }
                },
                { deep, immediate },
            );

            // Return cleanup function to prevent memory leaks
            // cleanup is now a function -> () => effect.stop()
            return cleanup;
        } catch (error) {
            logger.error(
                `useWatch: Failed to set up watcher: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }, [store, deep, immediate]); // Reconfigure watcher when behavior flags change
}
