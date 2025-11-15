import typescriptEslint from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import tsParser from '@typescript-eslint/parser';

export default [
    {
        ignores: ['**/dist/**', '**/node_modules/**'],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        plugins: {
            '@typescript-eslint': typescriptEslint,
            prettier,
            'unused-imports': unusedImports,
        },

        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2020,
            sourceType: 'module',
        },

        rules: {
            'prettier/prettier': 'error',
            
            // General TS rules
            '@typescript-eslint/no-explicit-any': 'off',

            // Disable the unused-vars rule from unused-imports
            'unused-imports/no-unused-vars': 'off',

            // Enable unused-imports for imports only
            'unused-imports/no-unused-imports': 'warn',

            // Use @typescript-eslint for variable warnings, but ignore vars/args starting with "_"
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    vars: 'all',
                    varsIgnorePattern: '^_',
                    args: 'after-used',
                    argsIgnorePattern: '^_',
                },
            ],
        },

    },
];
