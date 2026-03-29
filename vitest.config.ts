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
                // Pure type definition files (no runtime code)
                'packages/core/src/type/**',
                // DOM-only adapters (require real browser APIs)
                'packages/core/src/persistence/adapters/**',
                // DevTools React component (requires full Preact runtime)
                'packages/react/src/components/QuantaDevTools.tsx',
                // Large UI surfaces intentionally validated via targeted runtime tests
                'packages/devtools/src/DevTools.tsx',
                'packages/devtools/src/components/**',
            ],
            thresholds: {
                lines: 82,
                functions: 88,
                branches: 62,
                statements: 82,
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
