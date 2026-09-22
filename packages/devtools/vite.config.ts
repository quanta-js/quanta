import { defineConfig } from 'vite';
import banner from 'vite-plugin-banner';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import preact from '@preact/preset-vite';

const licenseBanner = readFileSync(resolve(__dirname, '../../LICENSE'), 'utf8');
const { version } = JSON.parse(
    readFileSync(resolve(__dirname, 'package.json'), 'utf8'),
);

// Declarations are emitted by `tsc -p tsconfig.build.json`.
export default defineConfig({
    root: '.',
    define: {
        __DEVTOOLS_VERSION__: JSON.stringify(version),
    },
    plugins: [
        preact(),
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
