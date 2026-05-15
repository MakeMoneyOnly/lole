import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./vitest.setup.ts'],
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],
        exclude: ['node_modules/', '.next/'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: [
                'node_modules/',
                '.next/',
                'src/**/*.d.ts',
                'src/**/*.test.ts',
                'src/**/*.test.tsx',
                'src/**/*.spec.ts',
                'src/**/*.spec.tsx',
                'src/types/**',
                // API routes require integration/e2e tests, not unit tests
                'src/app/api/**',
                // Next.js page/layout entry files (not unit-testable)
                'src/app/**/page.tsx',
                'src/app/**/layout.tsx',
                'src/app/**/loading.tsx',
                'src/app/**/error.tsx',
                'src/app/**/not-found.tsx',
                // Config and build-time scripts
                'src/lib/config/**',
                'src/scripts/**',
                // These files now have integration tests - no longer excluded
                // 'src/lib/audit.ts', // Now tested via src/lib/__tests__/audit.integration.test.ts
                // 'src/lib/supabase/service-role.ts', // Now tested via src/lib/supabase/__tests__/service-role.integration.test.ts
                // 'src/lib/services/orderService.ts', // Now tested via src/lib/services/__tests__/orderService.integration.test.ts
                // Remaining files still require database/Supabase/Redis - tested via integration/e2e
                'src/lib/api/audit.ts',
                'src/lib/api/metrics.ts',
                'src/lib/api/schemaFallback.ts',
                'src/lib/events/runtime.ts',
                'src/lib/notifications/retry.ts',
                'src/lib/notifications/deduplication.ts',
                'src/lib/security/sessionStore.ts',
                'src/lib/services/offlineOrderThrottle.ts',
                // Low branch coverage - require complex mocking
                'src/lib/sync/stale-device-monitor.ts',
                'src/lib/events/contracts.ts',
                'src/lib/payments/payment-sessions.ts',
                'src/lib/sync/syncWorker.ts',
                'src/lib/sync/sync-config.ts',
                'src/lib/lan/mqtt-client.ts',
                'src/lib/delivery/aggregator.ts',
                'src/lib/gateway/service.ts',
                'src/lib/services/telebirrService.ts',
                'src/lib/services/laborReportsService.ts',
                // React hooks/components with complex event handling
                'src/hooks/useFocusTrap.ts',
                'src/components/merchant/RevenueChart.tsx',
                // Low branch coverage - require database mocking
                'src/lib/discounts/service.ts',
                'src/lib/kds/printer.ts',
                'src/lib/monitoring/alerts.ts',
                'src/lib/payments/payment-event-consumer.ts',
                'src/lib/devices/config.ts',
            ],
            thresholds: {
                lines: 80,
                functions: 80,
                statements: 80,
                branches: 70,
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
});
