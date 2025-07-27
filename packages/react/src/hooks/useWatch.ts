import { useEffect, useRef } from 'react';
import { watch } from '@quantajs/core';
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
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        watch(
            () => watchFn(store),
            (newValue: T) => callbackRef.current(newValue),
        );

        // Note: The core watch function doesn't return a cleanup function
        // so we can't clean up the watcher when the component unmounts
        // This is a limitation of the current core implementation
    }, [store, watchFn]);
}
