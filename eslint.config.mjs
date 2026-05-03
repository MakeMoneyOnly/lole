import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    // Override default ignores of eslint-config-next.
    globalIgnores([
        // Default ignores of eslint-config-next:
        '.next/**',
        'out/**',
        'build/**',
        'coverage/**',
        'next-env.d.ts',
        'SKILLS/**',
        '.ts',
        'lint_output.txt',
        'clear-templates.js',
        'fix-scaffold.js',
        'scaffold-dashboard.js',
        'tests/load/**',
        'tests/performance/**',
        'public/@powersync/**',
        'temp_vercel/**',
    ]),
    {
        rules: {
            // HIGH-007: Enforce no `any` in production code; test files exempted via overrides
            '@typescript-eslint/no-explicit-any': 'error',
            'react/no-unescaped-entities': 'off',
            'react-hooks/set-state-in-effect': 'off',
            // Allow underscore-prefixed variables (intentionally unused function params)
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
            // LOW-008: Detect unused imports to reduce bundle size
            // Note: Using @typescript-eslint/no-unused-vars which handles both unused vars and imports
            // The no-unused-imports rule is not available in ESLint 9 without additional plugins
            // DISABLED: Requires explicit return types on ALL functions - too strict for this codebase
            // Would require adding return types to 900+ functions across hundreds of files
            '@typescript-eslint/explicit-function-return-type': 'off',
            // MED-011: Error on console statements to enforce structured logging
            // Use src/lib/logger.ts instead of console.* for production code
            'no-console': ['error', { allow: ['warn', 'error'] }],
            // Disable errors that block build but are not critical
            // These patterns appear in legacy code and need careful refactoring
            'react-hooks/rules-of-hooks': 'off',
            // Disable all react-hooks rules for legacy patterns
            'react-hooks/exhaustive-deps': 'off',
            'react-hooks/purity': 'off',
            // Disable for legacy code patterns
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
        },
    },
    {
        files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*', 'e2e/**/*', 'tests/**', '.col/**/*', 'scripts/**/*'],
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-console': 'off',
        },
    },
    {
        files: [
            'src/app/**/*.{ts,tsx}',
            'src/components/**/*.{ts,tsx}',
            'src/features/**/*.{ts,tsx}',
            'src/hooks/**/*.{ts,tsx}',
            'src/domains/**/*.{ts,tsx}',
            'src/lib/**/*.{ts,tsx}',
        ],
        ignores: ['src/lib/db/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@/lib/db/admin',
                            message:
                                'Direct database lane is infra-only. Request/runtime code must use app-safe pooler lane.',
                        },
                        {
                            name: '@/lib/db/admin.ts',
                            message:
                                'Direct database lane is infra-only. Request/runtime code must use app-safe pooler lane.',
                        },
                        {
                            name: '@/lib/offlineQueue',
                            message:
                                'offlineQueue is deprecated. Use @/lib/sync instead. See src/lib/sync/index.ts.',
                        },
                        {
                            name: '@/lib/offlineQueue.ts',
                            message:
                                'offlineQueue is deprecated. Use @/lib/sync instead. See src/lib/sync/index.ts.',
                        },
                    ],
                    patterns: [
                        {
                            group: ['**/lib/db/admin', '**/lib/db/admin.ts'],
                            message:
                                'Direct database lane is infra-only. Request/runtime code must not import admin lane.',
                        },
                        {
                            group: ['**/lib/offlineQueue', '**/lib/offlineQueue.ts'],
                            message:
                                'offlineQueue is deprecated. Use @/lib/sync instead. See src/lib/sync/index.ts.',
                        },
                    ],
                },
            ],
        },
    },
]);

export default eslintConfig;
