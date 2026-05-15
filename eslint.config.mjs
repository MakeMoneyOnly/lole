import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import reactHooks from 'eslint-plugin-react-hooks';

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
        'tests/load/**',
        'tests/performance/**',
        'public/@powersync/**',
    ]),
    {
        plugins: {
            'react-hooks': reactHooks,
        },
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
            // MED-011: Enforce structured logging - no console statements allowed
            'no-console': 'error',
            'react-hooks/purity': 'off',
            // React hooks rules - error level for stricter enforcement
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
            // Disable for legacy code patterns
            'no-use-before-define': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
        },
    },
    {
        files: [
            '**/*.test.ts',
            '**/*.test.tsx',
            '**/__tests__/**/*',
            'e2e/**/*',
            'tests/**',
            '.col/**/*',
            'scripts/**/*',
        ],
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
            // Architecture boundary: features cannot import domains (use services via hooks)
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
                        {
                            name: '@/lib/mobile/offline-order-manager',
                            message:
                                'Deleted. Use @/lib/sync (orderSync) instead. See src/lib/sync/index.ts.',
                        },
                        {
                            name: '@/lib/mobile/offline-conflict-resolver',
                            message: 'Deleted. Use @/lib/sync (conflict-resolution) instead.',
                        },
                        {
                            name: '@/lib/mobile/background-sync',
                            message: 'Deleted. Use @/lib/sync (syncWorker) instead.',
                        },
                        {
                            name: '@/features/kds/lib/offlineQueue',
                            message: 'Deleted. Use @/lib/sync (kdsSync + syncAdapter) instead.',
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
                            message: 'offlineQueue is deprecated. Use @/lib/sync instead.',
                        },
                        {
                            group: [
                                '**/lib/mobile/offline-order-manager',
                                '**/lib/mobile/offline-order-manager.ts',
                            ],
                            message: 'Deleted. Use @/lib/sync (orderSync) instead.',
                        },
                        {
                            group: [
                                '**/lib/mobile/offline-conflict-resolver',
                                '**/lib/mobile/offline-conflict-resolver.ts',
                            ],
                            message: 'Deleted. Use @/lib/sync (conflict-resolution) instead.',
                        },
                        {
                            group: [
                                '**/lib/mobile/background-sync',
                                '**/lib/mobile/background-sync.ts',
                            ],
                            message: 'Deleted. Use @/lib/sync (syncWorker) instead.',
                        },
                        {
                            group: [
                                '**/features/kds/lib/offlineQueue',
                                '**/features/kds/lib/offlineQueue.ts',
                            ],
                            message: 'Deleted. Use @/lib/sync (kdsSync) instead.',
                        },
                    ],
                },
            ],
            'no-restricted-syntax': [
                'error',
                {
                    // Prevent custom DB type definitions (use generated types)
                    selector: 'TSTypeDeclaration[id.name=/.*Row$/]',
                    message:
                        'Custom database row types are forbidden. Use Database["public"]["Tables"][tableName]["Row"] from @/types/database.',
                },
                {
                    selector:
                        'MemberExpression[object.name="process"][property.name="env"] > MemberExpression[property.name="SUPABASE_SERVICE_ROLE_KEY"], MemberExpression[object.name="process"][property.name="env"] > MemberExpression[property.name="SUPABASE_SECRET_KEY"]',
                    message:
                        'SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SECRET_KEY must only be used in server-side API routes and lib files. Use createServiceRoleClient() from @/lib/supabase/service-role instead.',
                },
            ],
        },
    },
]);

export default eslintConfig;
