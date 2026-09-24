import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const licenseBanner = `/*!\n${readFileSync(resolve(__dirname, '../../LICENSE'), 'utf8').trim()}\n*/`;

export default defineConfig({
    // Declarations are emitted by `tsc -p tsconfig.build.json`, as in
    // @quantajs/react.
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
        },
        sourcemap: true,
        rollupOptions: {
            external: [],
            output: [
                {
                    // One file per source module. With `sideEffects: false`, an
                    // app's bundler can then drop whole modules it never
                    // imports; from a single file it could only drop unused
                    // functions, so module-level code such as the DevTools hook
                    // shipped to every app (1.2–1.4 KB gzip).
                    format: 'es',
                    preserveModules: true,
                    preserveModulesRoot: 'src',
                    entryFileNames: '[name].mjs',
                    banner: (chunk) => (chunk.isEntry ? licenseBanner : ''),
                },
                {
                    // CommonJS consumers do not tree-shake; one file is simpler.
                    format: 'cjs',
                    entryFileNames: 'index.cjs',
                    banner: licenseBanner,
                },
            ],
        },
    },
});
