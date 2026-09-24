import { getDefaultContainer, type ContainerSnapshot } from '@quantajs/core';

declare global {
    interface Window {
        /** The request's state, written into the page by the middleware. */
        __QUANTA__?: ContainerSnapshot;
        /** Applies `__QUANTA__`; the page's script calls it once loaded. */
        __QUANTA_ADOPT__?: () => void;
    }
}

/**
 * Seed the browser's default container, which every island resolves against,
 * with the state the server rendered the page from.
 */
function adopt(): void {
    const snapshot = window.__QUANTA__;
    if (snapshot === undefined) return;
    delete window.__QUANTA__;
    getDefaultContainer().hydrate(snapshot);
}

// Runs before any island hydrates: the integration injects it at Astro's
// "before-hydration" stage.
adopt();

// After a view transition this module is already loaded, so the new page's
// snapshot script calls it directly.
window.__QUANTA_ADOPT__ = adopt;
