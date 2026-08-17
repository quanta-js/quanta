/**
 * Build-time environment detection.
 *
 * `__DEV__` gates every diagnostic in the library's hot paths. Bundlers that
 * perform dead-code elimination (Vite, webpack, Rollup, esbuild) statically
 * replace `process.env.NODE_ENV`, so the entire branch — including the
 * template literals used to build the messages — is removed from production
 * builds. That matters: the previous implementation built error strings inside
 * `try/catch` blocks in the proxy traps, which ran on every property access.
 *
 * The lookup is resolved once at module load rather than per call so that a
 * non-replaced `process` reference costs a single `typeof` check overall.
 */
function detectDev(): boolean {
    // Vite / modern bundlers: import.meta.env.DEV
    try {
        const meta = import.meta as unknown as
            | { env?: { DEV?: boolean; MODE?: string } }
            | undefined;
        if (meta && meta.env) {
            if (typeof meta.env.DEV === 'boolean') return meta.env.DEV;
            if (typeof meta.env.MODE === 'string') {
                return meta.env.MODE !== 'production';
            }
        }
    } catch {
        /* import.meta is unavailable in CJS output — fall through */
    }

    // Node / webpack / Jest
    try {
        if (
            typeof process !== 'undefined' &&
            process.env &&
            typeof process.env.NODE_ENV === 'string'
        ) {
            return process.env.NODE_ENV !== 'production';
        }
    } catch {
        /* `process` may be shadowed or throw in exotic sandboxes */
    }

    // No signal either way. Default to development so that diagnostics are
    // available in plain <script type="module"> usage, where a developer has
    // no bundler to tell us otherwise. Production users get the quiet path via
    // their bundler's NODE_ENV replacement.
    return true;
}

/** True when diagnostics should be emitted. Tree-shaken away in prod builds. */
export const __DEV__: boolean = detectDev();

/** True when running inside a browser-like environment with a DOM. */
export function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}
