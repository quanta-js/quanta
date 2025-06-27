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
            exclude: ['src/**/*.test.ts'],
            rollupTypes: true,
            outDir: 'dist',
            insertTypesEntry: true,
        }),
        banner(licenseBanner),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'QuantaJS',
            fileName: (format) => `index.${format === 'es' ? 'mjs' : 'js'}`,
        },
        rollupOptions: {
            external: [],
            output: {
                globals: {},
            },
        },
    },
});
