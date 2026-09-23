'use client';

import { useEffect, useRef } from 'react';
import type { StoreContainer } from '@quantajs/core';

/**
 * Dispose `container` when the component unmounts for real.
 *
 * StrictMode, in development, runs every effect's cleanup and then its setup
 * again straight after mounting. Disposing in the cleanup would destroy a
 * container the component goes on rendering with. Instead the cleanup
 * schedules disposal, and a setup that follows for the same container
 * cancels it; after a real unmount nothing follows and the container is
 * disposed.
 */
export function useDisposeOnUnmount(container: StoreContainer | null): void {
    const pending = useRef<{
        container: StoreContainer;
        timer: ReturnType<typeof setTimeout>;
    } | null>(null);

    useEffect(() => {
        if (container === null) return;
        if (pending.current?.container === container) {
            clearTimeout(pending.current.timer);
            pending.current = null;
        }
        return () => {
            const timer = setTimeout(() => {
                if (pending.current?.container === container) {
                    pending.current = null;
                }
                container.dispose();
            }, 0);
            pending.current = { container, timer };
        };
    }, [container]);
}
