import { useEffect, useRef } from 'react';
import { watch, logger } from '@quantajs/core';
import type { RawActions, StoreInstance } from '@quantajs/core';

/**
 * Hook to watch for changes in store values and execute side effects
 * @param store - The QuantaJS store instance
 * @param watchFn - Function that returns the value to watch
 * @param callback - Callback to execute when the watched value changes
 */
export function useWatch<
    S extends object,
    GDefs extends Record<string, (state: S) => any> = {},
    A extends RawActions = {},
    T = any,
>(
    store: StoreInstance<S, GDefs, A>,
    watchFn: (store: StoreInstance<S, GDefs, A>) => T,
    callback: (newValue: T) => void,
): void {
    // Stabilize callback and watchFn with refs to avoid effect re-runs on every render
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    const watchFnRef = useRef(watchFn);
    watchFnRef.current = watchFn;

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
            );

            // Return cleanup function to prevent memory leaks
            return typeof cleanup === 'function' ? cleanup : undefined;
        } catch (error) {
            logger.error(
                `useWatch: Failed to set up watcher: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }, [store]); // Only re-run when store changes — watchFn/callback stabilized via refs
}
