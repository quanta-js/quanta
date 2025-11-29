import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import banner from 'vite-plugin-banner';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const licenseBanner = readFileSync(resolve(__dirname, '../../LICENSE'), 'utf8');

export default defineConfig({
    plugins: [
        tailwindcss(),
        react({
            jsxImportSource: 'preact',
        }),
        dts({
            insertTypesEntry: true,
        }),
        banner({
            content: licenseBanner,
        }),
    ],
    resolve: {
        alias: {
            react: 'preact/compat',
            'react-dom': 'preact/compat',
        },
    },
    build: {
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
            },
        },
        commonjsOptions: {
            include: [/preact/, /node_modules/],
        },
    },
});
