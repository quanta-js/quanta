import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import banner from 'vite-plugin-banner';

const licenseBanner = readFileSync(resolve(__dirname, '../../LICENSE'), 'utf8');

// ES only: Astro loads integrations, middleware and client scripts as
// modules. Declarations come from `tsc -p tsconfig.build.json`.
export default defineConfig({
    plugins: [banner(licenseBanner) as never],
    build: {
        lib: {
            entry: {
                index: resolve(__dirname, 'src/index.ts'),
                middleware: resolve(__dirname, 'src/middleware.ts'),
                client: resolve(__dirname, 'src/client.ts'),
            },
            formats: ['es'],
            fileName: (_format, entryName) => `${entryName}.js`,
        },
        sourcemap: true,
        rollupOptions: {
            external: [/^astro(\/|:|$)/, '@quantajs/core', 'devalue', /^node:/],
        },
        minify: 'esbuild',
    },
});
