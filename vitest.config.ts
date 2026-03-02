import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['packages/*/src/**/*.{test,spec}.{ts,tsx}'],
        exclude: ['**/node_modules/**', '**/dist/**'],
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
                '**/*.bench.{ts,tsx}',
                '**/index.ts',
                'packages/devtools/**',
                // Pure type definition files (no runtime code)
                'packages/core/src/type/**',
                // DOM-only adapters (require real browser APIs)
                'packages/core/src/persistence/adapters/**',
                // DevTools React component (requires full Preact runtime)
                'packages/react/src/components/QuantaDevTools.tsx',
            ],
            thresholds: {
                lines: 75,
                functions: 75,
                branches: 55,
                statements: 75,
            },
        },
        typecheck: {
            enabled: false,
        },
        benchmark: {
            include: ['packages/*/src/**/*.bench.{ts,tsx}'],
        },
        alias: {
            '@quantajs/core': path.resolve(__dirname, 'packages/core/src'),
            '@quantajs/react': path.resolve(__dirname, 'packages/react/src'),
            '@quantajs/devtools': path.resolve(
                __dirname,
                'packages/devtools/src',
            ),
        },
    },
});
