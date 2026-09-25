import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import banner from 'vite-plugin-banner';

const licenseBanner = readFileSync(resolve(__dirname, '../../LICENSE'), 'utf8');

// Declarations come from `tsc -p tsconfig.build.json`, as in the other
// packages.
export default defineConfig({
    plugins: [banner(licenseBanner) as never],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
        },
        sourcemap: true,
        rollupOptions: {
            external: ['vue', /^vue\//, '@quantajs/core'],
        },
        minify: 'esbuild',
    },
});
