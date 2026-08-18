'use client';

/**
 * The DevTools panel, kept out of the package barrel.
 *
 * ```tsx
 * import { QuantaDevTools } from '@quantajs/react/devtools';
 * ```
 *
 * `@quantajs/devtools` must be installed to use this entry point — it is an
 * optional peer, and this is the only module that needs it. Importing from
 * here is what opts your build into resolving it; the main `@quantajs/react`
 * entry never references it.
 */

export { QuantaDevTools } from './components/QuantaDevTools';
export type { QuantaDevToolsProps } from './components/devtools-types';
