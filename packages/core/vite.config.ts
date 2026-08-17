import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import banner from 'vite-plugin-banner';
import { readFileSync } from 'fs';

const licenseBanner = readFileSync(resolve(__dirname, '../../LICENSE'), 'utf8');

export default defineConfig({
    plugins: [
        dts({
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/__tests__/**'],
            rollupTypes: true,
            outDir: 'dist',
            insertTypesEntry: true,
        }),
        banner(licenseBanner) as never,
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            // Explicit ES + CJS only. The previous config declared `name`,
            // which made Vite emit a UMD bundle as `index.js` — and because the
            // package is `"type": "module"`, Node parsed that UMD file as ESM.
            // It did not crash: the wrapper found no `exports` and no `define`,
            // so it took its global-assignment branch, `require()` returned an
            // empty object, and every export was silently written onto
            // `globalThis.QuantaJS`.
            formats: ['es', 'cjs'],
            fileName: (format: string) =>
                format === 'es' ? 'index.mjs' : 'index.cjs',
        },
        sourcemap: true,
        rollupOptions: {
            external: [],
        },
    },
});
