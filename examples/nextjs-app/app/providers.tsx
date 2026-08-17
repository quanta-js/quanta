'use client';

import type { ReactNode } from 'react';
import type { ContainerSnapshot } from '@quantajs/core';
import { QuantaProvider, useQuanta } from '@quantajs/react';
import { useCounterStore } from '../lib/store';

/**
 * The client boundary. `<QuantaProvider>` creates its own container on the
 * client (none is passed here) and applies `snapshot` — produced by
 * `container.dehydrate()` on the server — before the first paint, so the
 * client's first render matches the server's HTML instead of flashing
 * default state and correcting itself.
 */
export function Providers({
    snapshot,
    children,
}: {
    snapshot: ContainerSnapshot;
    children: ReactNode;
}) {
    return <QuantaProvider snapshot={snapshot}>{children}</QuantaProvider>;
}

/** A Client Component reading and mutating the store — proves the store
 * built with `state`/`getters`/`actions` on the server is live on the
 * client, not just inert HTML. */
export function Counter() {
    const counter = useQuanta(useCounterStore);
    return (
        <p>
            server sent count = {counter.count} (doubled: {counter.doubled}) —{' '}
            <button onClick={() => counter.increment()}>increment</button>
        </p>
    );
}
