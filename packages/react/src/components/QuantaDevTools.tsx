'use client';

import { useEffect } from 'react';
import { enableDevTools, disableDevTools } from '@quantajs/core';
import type { QuantaDevToolsProps } from './devtools-types';

export type { QuantaDevToolsProps };

function isDevBuild(): boolean {
    try {
        const meta = import.meta as unknown as { env?: { DEV?: boolean } };
        if (meta?.env && typeof meta.env.DEV === 'boolean') return meta.env.DEV;
    } catch {
        /* not available in CJS output */
    }
    return (
        typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'
    );
}

/**
 * Mount the QuantaJS DevTools panel.
 *
 * Import this from `@quantajs/react/devtools`, not from `@quantajs/react`.
 *
 * The panel UI is loaded with a **dynamic import**, so `@quantajs/devtools`
 * and its Preact runtime are code-split into a separate chunk instead of being
 * bundled into every application that imports `@quantajs/react`. When the panel
 * is not rendered, the chunk is never fetched.
 *
 * That dynamic import is also why this module is not reachable from the
 * package barrel. `import('@quantajs/devtools')` is a static specifier, so a
 * bundler resolves it at build time to plan the chunk — and `@quantajs/devtools`
 * is an *optional* peer, so it is frequently not installed. In 2.1.0 this
 * module sat in the barrel, and the result was that any application importing
 * anything at all from `@quantajs/react` failed to build with
 * `Module not found: Can't resolve '@quantajs/devtools'` unless it happened to
 * have the package. Keeping the import behind a subpath means only the
 * applications that ask for the panel need the peer.
 */
export const QuantaDevTools = ({ visible, redact }: QuantaDevToolsProps) => {
    useEffect(() => {
        const shouldMount = visible ?? isDevBuild();
        if (!shouldMount) return;

        let cleanup: (() => void) | undefined;
        let cancelled = false;

        enableDevTools(redact ? { redact } : undefined);

        void import('@quantajs/devtools').then(({ mountDevTools }) => {
            if (cancelled) return;
            cleanup = mountDevTools({ visible: true });
        });

        return () => {
            cancelled = true;
            cleanup?.();
            disableDevTools();
        };
        // `redact` is an array literal in most call sites; join it so a stable
        // list does not remount the panel on every render.
    }, [visible, redact?.join('|')]);

    return null;
};
