'use client';

import { ReactNode, useEffect, useMemo, useRef } from 'react';
import {
    createContainer,
    type ContainerSnapshot,
    type StoreContainer,
} from '@quantajs/core';
import { QuantaContext } from '../context/QuantaContext';

export interface QuantaProviderProps {
    /**
     * The container stores resolve against.
     *
     * Omit it in a client-only app and one is created for this provider. In a
     * server-rendered app, create it per request and pass it in — the ambient
     * container is shared across every request in the process.
     */
    container?: StoreContainer;

    /**
     * Server state to apply before the first render, as produced by
     * `container.dehydrate()`.
     *
     * Applied synchronously during the first render, *before* children mount,
     * so the initial client render matches the server's markup instead of
     * flashing default state and then correcting itself. Stores that do not
     * exist yet keep their snapshot until they are first resolved, so
     * lazily-created stores hydrate correctly too.
     */
    snapshot?: ContainerSnapshot;

    children: ReactNode;
}

/**
 * Provide a store container to a React tree.
 */
export function QuantaProvider({
    container,
    snapshot,
    children,
}: QuantaProviderProps) {
    // An internally-created container must survive re-renders, so it lives in
    // a ref rather than being rebuilt each time.
    const ownedRef = useRef<StoreContainer | null>(null);
    if (container === undefined && ownedRef.current === null) {
        ownedRef.current = createContainer('react');
    }
    const active = container ?? ownedRef.current!;

    // Hydrate during render, not in an effect: an effect runs *after* the
    // first paint, which is precisely the hydration-mismatch flash this is
    // meant to prevent. Guarded so it happens once per snapshot.
    const hydratedRef = useRef<ContainerSnapshot | null>(null);
    if (snapshot !== undefined && hydratedRef.current !== snapshot) {
        hydratedRef.current = snapshot;
        active.hydrate(snapshot);
    }

    // Only dispose a container this provider created. A caller-supplied one
    // has a lifetime the caller controls — disposing it here would destroy a
    // request-scoped container out from under its owner.
    useEffect(() => {
        const owned = ownedRef.current;
        return () => {
            if (owned && container === undefined) owned.dispose();
        };
    }, [container]);

    const value = useMemo(() => ({ container: active }), [active]);

    return (
        <QuantaContext.Provider value={value}>
            {children}
        </QuantaContext.Provider>
    );
}
