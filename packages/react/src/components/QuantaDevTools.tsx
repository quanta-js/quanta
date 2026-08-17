'use client';

import { useEffect } from 'react';
import { enableDevTools, disableDevTools } from '@quantajs/core';

export interface QuantaDevToolsProps {
    /**
     * Force the panel on or off. When omitted, the panel mounts only in a
     * development build.
     */
    visible?: boolean;
    /**
     * Property paths to mask in the panel, e.g. `['token', 'user.ssn']`.
     * DevTools reports full state and every action argument, so redact
     * anything sensitive before it reaches the panel.
     */
    redact?: string[];
}

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
 * The panel UI is loaded with a **dynamic import**, so `@quantajs/devtools`
 * and its Preact runtime are code-split into a separate chunk instead of being
 * bundled into every application that imports `@quantajs/react`. When the panel
 * is not rendered, the chunk is never fetched.
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
