import type { AstroIntegration } from 'astro';

/**
 * QuantaJS for Astro.
 *
 * - Each request gets its own store container, available as
 *   `Astro.locals.quanta` and used by default while the request renders, so
 *   islands rendered on the server read that request's state.
 * - The container's state is written into the page and hydrated in the
 *   browser before any island, so React, Vue and Svelte islands start from
 *   what the server rendered, and share one store from then on.
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import { defineConfig } from 'astro/config';
 * import quanta from '@quantajs/astro';
 *
 * export default defineConfig({ integrations: [quanta()] });
 * ```
 */
export default function quanta(): AstroIntegration {
    return {
        name: '@quantajs/astro',
        hooks: {
            'astro:config:setup': ({ addMiddleware, injectScript }) => {
                addMiddleware({
                    entrypoint: '@quantajs/astro/middleware',
                    order: 'pre',
                });
                injectScript(
                    'before-hydration',
                    `import '@quantajs/astro/client';`,
                );
            },
            'astro:config:done': ({ injectTypes }) => {
                injectTypes({
                    filename: 'types.d.ts',
                    content: `declare namespace App {
    interface Locals {
        /** This request's QuantaJS store container. */
        quanta: import('@quantajs/core').StoreContainer;
    }
}
`,
                });
            },
        },
    };
}
