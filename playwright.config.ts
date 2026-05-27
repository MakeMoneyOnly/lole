import { defineConfig, devices } from '@playwright/test';

const isCI = process.env.CI === 'true';

// Helper to get env var or fallback
const getEnv = (key: string, fallback: string = ''): string => process.env[key] || fallback;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    workers: isCI ? 1 : 4,
    timeout: 45000,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },
    webServer: {
        command: isCI ? 'pnpm start' : 'pnpm exec next dev -p 3000 --webpack',
        url: 'http://localhost:3000',
        reuseExistingServer: !isCI,
        timeout: 120 * 1000,
        env: {
            CI: 'true',
            NEXT_PUBLIC_SUPABASE_URL: getEnv(
                'NEXT_PUBLIC_SUPABASE_URL',
                'https://placeholder.supabase.co'
            ),
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: getEnv(
                'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
                'placeholder-key'
            ),
            SUPABASE_SECRET_KEY: getEnv('SUPABASE_SECRET_KEY', 'placeholder-secret'),
            SUPABASE_DB_URL: getEnv('SUPABASE_DB_URL'),
            NEXT_PUBLIC_APP_URL: getEnv('NEXT_PUBLIC_APP_URL', 'https://lole.app'),
            NEXT_PUBLIC_APP_NAME: getEnv('NEXT_PUBLIC_APP_NAME', 'lole'),
            QR_HMAC_SECRET: getEnv(
                'QR_HMAC_SECRET',
                '0000000000000000000000000000000000000000000000000000000000000000'
            ),
            UPSTASH_REDIS_REST_URL: getEnv('UPSTASH_REDIS_REST_URL'),
            UPSTASH_REDIS_REST_TOKEN: getEnv('UPSTASH_REDIS_REST_TOKEN'),
            E2E_TEST_MODE: getEnv('E2E_TEST_MODE', 'true'),
            E2E_BYPASS_SECRET: getEnv('E2E_BYPASS_SECRET', 'e2e-test-secret'),
        },
    },
    projects: isCI
        ? [
              {
                  name: 'chromium',
                  use: { ...devices['Desktop Chrome'] },
              },
              {
                  name: 'firefox',
                  use: { ...devices['Desktop Firefox'] },
              },
          ]
        : [
              {
                  name: 'chromium',
                  use: { ...devices['Desktop Chrome'] },
              },
              {
                  name: 'firefox',
                  use: { ...devices['Desktop Firefox'] },
              },
              {
                  name: 'Mobile Chrome',
                  use: { ...devices['Pixel 5'] },
              },
              {
                  name: 'Mobile Safari',
                  use: { ...devices['iPhone 12'] },
              },
          ],
});
