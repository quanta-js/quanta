/**
 * Whether a Web Storage area is usable in the current environment.
 *
 * Presence is not sufficient. On the server the global does not exist at all;
 * in Safari private mode and under hardened browser settings the object is
 * present but throws on write; and some enterprise policies expose a storage
 * object whose quota is zero. The only reliable test is to attempt a
 * round-trip.
 *
 * Probing once in the adapter constructor keeps the per-operation cost at a
 * single boolean check.
 */
export function storageAvailable(
    kind: 'localStorage' | 'sessionStorage',
): boolean {
    try {
        if (typeof window === 'undefined') return false;
        const area = window[kind];
        if (!area) return false;

        const probe = '__quanta_probe__';
        area.setItem(probe, probe);
        area.removeItem(probe);
        return true;
    } catch {
        return false;
    }
}
