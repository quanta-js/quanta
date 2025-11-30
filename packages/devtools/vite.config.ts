import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import banner from 'vite-plugin-banner';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import preact from '@preact/preset-vite';

const licenseBanner = readFileSync(resolve(__dirname, '../../LICENSE'), 'utf8');

export default defineConfig({
    root: '.', // Keep root at package root
    plugins: [
        tailwindcss(),
        preact(),
        dts({
            insertTypesEntry: true,
            exclude: ['test/**/*'], // Exclude test directory from types
        }),
        banner({
            content: licenseBanner,
        }),
    ],
    css: {
        postcss: './postcss.config.js'
    },
    resolve: {
        alias: {
            react: 'preact/compat',
            'react-dom': 'preact/compat',
        },
    },
    build: {
        cssCodeSplit: false, // IMPORTANT: Keep CSS in one file
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
                // ADDED: Ensure CSS is generated with predictable name
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name === 'style.css') {
                        return 'index.css'; // This will be imported as ?inline
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
