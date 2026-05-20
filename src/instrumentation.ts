import { logger } from '@/lib/logger';

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { assertSecretsValid } = await import('@/lib/security/startup-checks');

        try {
            assertSecretsValid();
        } catch (error) {
            logger.error('Startup secret validation failed', error);
            if (process.env.NODE_ENV === 'production') {
                process.exit(1);
            }
        }
    }
}
