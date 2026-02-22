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
            exclude: ['test/**/*'],
        }),
        banner({
            content: licenseBanner,
        }),
    ],
    build: {
        cssCodeSplit: false,
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'QuantaDevTools',
            fileName: (format) => `index.${format}.js`,
        },
        rollupOptions: {
            external: ['@quantajs/core'],
            output: {
                globals: {
                    '@quantajs/core': 'QuantaCore',
                },
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
