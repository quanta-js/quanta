import { useEffect, useRef } from 'react';
import { watch, logger } from '@quantajs/core';
import type { StoreInstance } from '@quantajs/core';

/**
 * Hook to watch for changes in store values and execute side effects
 * @param store - The QuantaJS store instance
 * @param watchFn - Function that returns the value to watch
 * @param callback - Callback to execute when the watched value changes
 */
export function useWatch<
    S extends object,
    G extends object,
    A extends object,
    T,
>(
    store: StoreInstance<S, G, A>,
    watchFn: (store: StoreInstance<S, G, A>) => T,
    callback: (newValue: T) => void,
): void {
    try {
        const callbackRef = useRef(callback);
        callbackRef.current = callback;

        useEffect(() => {
            try {
                watch(
                    () => {
                        try {
                            return watchFn(store);
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
            } catch (error) {
                logger.error(
                    `useWatch: Failed to set up watcher: ${error instanceof Error ? error.message : String(error)}`,
                );
                throw error;
            }

            // Note: The core watch function doesn't return a cleanup function
            // so we can't clean up the watcher when the component unmounts
            // This is a limitation of the current core implementation
        }, [store, watchFn]);
    } catch (error) {
        logger.error(
            `useWatch: Hook execution failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
    }
}
