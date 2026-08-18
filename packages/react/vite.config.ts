import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import banner from 'vite-plugin-banner';

const licenseBanner = readFileSync(resolve(__dirname, '../../LICENSE'), 'utf8');

// Declarations are emitted by `tsc -p tsconfig.build.json`, not by
// vite-plugin-dts. The plugin's API-Extractor rollup silently produced an empty
// `export { }` here — this package shipped with no types at all — because the
// bundled extractor is older than the TypeScript version the project uses. A
// plain `tsc` pass has no such coupling and fails loudly if it cannot resolve.
export default defineConfig({
    plugins: [banner(licenseBanner) as never],
    build: {
        lib: {
            // Two entries, deliberately. The DevTools panel dynamically
            // imports `@quantajs/devtools`, and a bundler resolves that static
            // specifier at build time — so while the panel lived in the main
            // entry, every consumer without that optional peer installed failed
            // to build. Splitting it out means only `@quantajs/react/devtools`
            // pulls the peer into the graph.
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                devtools: resolve(__dirname, 'src/devtools.ts'),
            },
            formats: ['es', 'cjs'],
            fileName: (format, entryName) =>
                `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
        },
        sourcemap: true,
        rollupOptions: {
            // Everything not authored here must stay external. Previously only
            // the exact string 'react' was listed, so `react/jsx-runtime` was
            // inlined (a second JSX runtime), and neither `@quantajs/devtools`
            // nor `preact` was external — which bundled the entire DevTools UI
            // and Preact into every application that imported this package.
            external: [
                'react',
                'react-dom',
                /^react\//,
                /^react-dom\//,
                '@quantajs/core',
                '@quantajs/devtools',
                'preact',
                /^preact\//,
            ],
            output: {
                // Keep the 'use client' banner: bundlers otherwise hoist or
                // drop the directive and Next.js App Router rejects the import.
                banner: "'use client';",
            },
        },
        minify: 'esbuild',
    },
});
