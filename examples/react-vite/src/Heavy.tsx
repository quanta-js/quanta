import { useQuantaValue } from '@quantajs/react';
import { useCartStore } from './stores';

/**
 * Loaded through `React.lazy` in `App.tsx`, never statically imported — so
 * Vite must emit it as its own chunk. Its content doesn't matter; only that
 * it exists as a separate module for the build-output check to find.
 */
export default function Heavy() {
    const items = useQuantaValue(useCartStore, (s) => s.items);
    return (
        <div>
            <p>Loaded on demand via a lazy, dynamically-imported chunk.</p>
            <pre>{JSON.stringify(items, null, 2)}</pre>
        </div>
    );
}
