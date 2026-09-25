import { defineConfig, type Plugin } from 'vitest/config';
import { compile, VERSION } from 'svelte/compiler';
import path from 'path';

/**
 * Compile `.svelte` test fixtures with whichever Svelte is installed, 4 or 5,
 * so CI can run the same tests against both. The official Vite plugin supports
 * only Svelte 5 with this Vite.
 */
function svelteFixtures(): Plugin {
    const legacy = Number(VERSION.split('.')[0]) < 5;
    return {
        name: 'quanta:svelte-fixtures',
        transform(code, id) {
            if (!id.endsWith('.svelte')) return null;
            const { js } = compile(code, {
                filename: id,
                generate: (legacy ? 'dom' : 'client') as never,
            });
            return { code: js.code, map: js.map };
        },
    };
}

export default defineConfig({
    define: {
        // Injected by the devtools build; tests render the panel from source.
        __DEVTOOLS_VERSION__: JSON.stringify('test'),
    },
    test: {
        globals: true,
        environment: 'node',
        projects: [
            {
                extends: true,
                test: {
                    name: 'packages',
                    include: ['packages/*/src/**/*.{test,spec}.{ts,tsx}'],
                    exclude: [
                        '**/node_modules/**',
                        '**/dist/**',
                        'packages/svelte/**',
                    ],
                },
            },
            {
                // Svelte components are compiled for the browser; without the
                // condition, `svelte` resolves to its server build.
                extends: true,
                plugins: [svelteFixtures()],
                resolve: { conditions: ['browser'] },
                test: {
                    name: 'svelte',
                    include: ['packages/svelte/src/**/*.test.ts'],
                },
            },
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
            include: ['packages/*/src/**/*.{ts,tsx}'],
            exclude: [
                '**/node_modules/**',
                '**/dist/**',
                '**/__tests__/**',
                '**/*.test.{ts,tsx}',
                '**/*.spec.{ts,tsx}',
                '**/*.test-d.{ts,tsx}',
                '**/index.ts',
                // Pure type definition files (no runtime code)
                'packages/core/src/type/**',
                // DevTools React component (requires full Preact runtime)
                'packages/react/src/components/QuantaDevTools.tsx',
                // Large UI surfaces intentionally validated via targeted runtime tests
                'packages/devtools/src/DevTools.tsx',
                'packages/devtools/src/components/**',
            ],
            // Raised to just below the levels reached by the 2.1 pass, so the
            // improvement is locked in and a regression fails the build rather
            // than quietly eroding. Leave a couple of points of headroom so
            // ordinary refactors don't trip the gate.
            thresholds: {
                lines: 86,
                functions: 89,
                branches: 71,
                statements: 84,
            },
        },
        typecheck: {
            enabled: false,
        },
        alias: {
            '@quantajs/core': path.resolve(__dirname, 'packages/core/src'),
            '@quantajs/react': path.resolve(__dirname, 'packages/react/src'),
            '@quantajs/vue': path.resolve(__dirname, 'packages/vue/src'),
            '@quantajs/svelte': path.resolve(__dirname, 'packages/svelte/src'),
            '@quantajs/lit': path.resolve(__dirname, 'packages/lit/src'),
            '@quantajs/astro': path.resolve(__dirname, 'packages/astro/src'),
            '@quantajs/devtools': path.resolve(
                __dirname,
                'packages/devtools/src',
            ),
        },
    },
});
