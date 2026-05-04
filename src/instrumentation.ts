/**
 * Next.js Instrumentation
 *
 * Runs once at server startup. Validates all required secrets before
 * the application starts accepting traffic.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { assertSecretsValid } = await import('@/lib/security/startup-checks');

        try {
            assertSecretsValid();
        } catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            if (process.env.NODE_ENV === 'production') {
                process.exit(1);
            }
        }
    }
}
