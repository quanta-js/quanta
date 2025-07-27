import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import banner from 'vite-plugin-banner';

const licenseBanner = readFileSync(resolve(__dirname, '../../LICENSE'), 'utf8');

export default defineConfig({
    plugins: [
        dts({
            include: ['src/**/*'],
            exclude: ['src/**/*.test.*', 'src/**/*.spec.*'],
            rollupTypes: true,
            outDir: 'dist',
            insertTypesEntry: true,
        }),
        banner(licenseBanner),
    ],
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'QuantaReact',
            formats: ['es', 'cjs'],
            fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
        },
        rollupOptions: {
            external: ['react', '@quantajs/core'],
            output: {
                globals: {
                    react: 'React',
                    '@quantajs/core': 'QuantaCore',
                },
            },
        },
        minify: 'esbuild',
    },
});
