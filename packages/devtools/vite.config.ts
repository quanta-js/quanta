import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import banner from 'vite-plugin-banner';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import preact from '@preact/preset-vite';

const licenseBanner = readFileSync(resolve(__dirname, '../../LICENSE'), 'utf8');

export default defineConfig({
    root: '.',
    plugins: [
        preact(),
        dts({
            insertTypesEntry: true,
            exclude: ['test/**/*', 'src/__tests__/**'],
        }),
        banner({
            content: licenseBanner,
        }) as any,
    ],
    build: {
        cssCodeSplit: false,
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            // ES + CJS with explicit extensions. A UMD bundle named `.js`
            // inside a `"type": "module"` package is parsed as ESM by Node,
            // so `require()` of it returned an empty object.
            formats: ['es', 'cjs'],
            fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.cjs'),
        },
        rollupOptions: {
            external: ['@quantajs/core'],
            output: {
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css') {
                        return 'index.css';
                    }
                    return assetInfo.name || 'assets/[name].[ext]';
                },
            },
        },
        commonjsOptions: {
            include: [/preact/, /node_modules/],
        },
    },
});
