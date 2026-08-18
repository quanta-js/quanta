'use client';

import { useEffect } from 'react';
import type { QuantaDevToolsProps } from './devtools-types';

let warned = false;

/**
 * Placeholder for the DevTools panel, which moved to
 * `@quantajs/react/devtools` in 2.1.1.
 *
 * ## Why this exists
 *
 * The real panel dynamically imports `@quantajs/devtools`. That specifier is
 * static, so bundlers resolve it at build time — and because the package is an
 * *optional* peer, it is usually absent. With the panel in the package barrel,
 * every application importing anything from `@quantajs/react` failed to build:
 *
 * ```
 * Module not found: Can't resolve '@quantajs/devtools'
 * ```
 *
 * Moving the panel behind a subpath fixes that, but it would also make
 * `import { QuantaDevTools } from '@quantajs/react'` a compile error. This stub
 * keeps that import valid so upgrading does not break a build a second time.
 *
 * ## Why it warns in production too
 *
 * This is a patch release, so it arrives automatically through a `^2.1.0`
 * range. For anyone who *did* have `@quantajs/devtools` installed, their panel
 * worked before the upgrade and does not after it — a regression they did not
 * opt into. A development-only warning would be invisible in exactly the builds
 * where someone might notice the panel is gone, so the warning is
 * unconditional. It fires once per process.
 */
export const QuantaDevTools = (_props: QuantaDevToolsProps) => {
    useEffect(() => {
        if (warned) return;
        warned = true;
        console.warn(
            '[QuantaJS] <QuantaDevTools /> moved to "@quantajs/react/devtools" ' +
                'in 2.1.1 and this import now renders nothing.\n' +
                '  - import { QuantaDevTools } from "@quantajs/react/devtools";\n' +
                '  - npm install --save-dev @quantajs/devtools\n' +
                'It moved because the panel dynamically imports @quantajs/devtools, ' +
                'which bundlers resolve at build time — leaving it in the package ' +
                'barrel broke the build of every app that did not install that ' +
                'optional peer.',
        );
    }, []);

    return null;
};

export type { QuantaDevToolsProps };
