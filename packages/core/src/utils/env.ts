/**
 * Whether to emit development diagnostics.
 *
 * `process.env.NODE_ENV` is written out in full so the app's bundler can
 * replace it with a string literal, as webpack, Vite, Next.js, Parcel and the
 * esbuild-based tools do. A production build then runs the quiet path. The
 * previous version read `import.meta` through a variable and guarded `process`
 * with `typeof`, which no bundler can resolve: in a production browser bundle
 * both checks failed and it fell back to development, printing diagnostics.
 *
 * Without a bundler, a browser has no `process`; reading it throws, and
 * diagnostics stay on, which is what someone using a plain
 * `<script type="module">` wants.
 */
function detectDev(): boolean {
    try {
        return process.env.NODE_ENV !== 'production';
    } catch {
        return true;
    }
}

/** True when diagnostics should be emitted. */
export const __DEV__: boolean = detectDev();

/** True when running inside a browser-like environment with a DOM. */
export function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}
