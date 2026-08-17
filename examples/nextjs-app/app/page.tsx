import { createContainer } from '@quantajs/core';
import { useCounterStore } from '../lib/store';
import { Providers, Counter } from './providers';

/**
 * A Server Component. **Never** resolve a store against the ambient
 * container here — this module runs in one Node process shared across every
 * request, so the ambient container would leak one visitor's state into
 * another's. A container created per request, right here in the request
 * path, is what keeps them isolated.
 */
export default function Page() {
    const container = createContainer();
    const counter = useCounterStore(container);

    // Stand-in for "load from a database / session" — anything that varies
    // per request.
    counter.count = 7;

    const snapshot = container.dehydrate();
    // The snapshot above is a plain, already-copied object — the container
    // itself is done being useful the moment it's taken.
    container.dispose();

    return (
        <Providers snapshot={snapshot}>
            <Counter />
        </Providers>
    );
}
