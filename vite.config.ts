import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
    plugins: [
        dts({
            include: ['src'],
            exclude: ['src/**/*.test.ts'],
            rollupTypes: true,
            outDir: 'dist',
            insertTypesEntry: true,
            beforeWriteFile: (filePath, content) => {
                // Remove any references to the type directory
                const cleanedContent = content
                    .replace(/from ['"]\.\/type\//g, "from './")
                    .replace(/from ['"]\.\.\/type\//g, "from './");
                return {
                    filePath: filePath.replace('/type/', '/'), // Fixed from '/types/' to '/type/'
                    content: cleanedContent
                };
            }
        }),
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