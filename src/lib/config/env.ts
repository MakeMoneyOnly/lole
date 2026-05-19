/**
 * Environment Configuration Validation
 *
 * Addresses COMPREHENSIVE_CODEBASE_AUDIT_REPORT Section 3.3
 * Validates required environment variables at startup
 */

import { z } from 'zod';
import { logger } from '@/lib/logger';

/**
 * Environment variable schema
 */
const envSchema = z.object({
    // Node environment
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),

    // Application
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    NEXT_PUBLIC_APP_NAME: z.string().default('lole'),

    // Supabase - Required
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),

    // Supabase - Modern Keys (Optional for build, required for runtime)
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),

    // Database
    DATABASE_URL: z.string().url().optional(),
    DATABASE_DIRECT_URL: z.string().url().optional(),
    SUPABASE_POOLER_URL: z.string().url().optional(),
    SUPABASE_DB_URL: z.string().url().optional(),
    POWERSYNC_DATABASE_URL: z.string().url().optional(),

    // Security
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
    HMAC_SECRET: z.string().min(32, 'HMAC_SECRET must be at least 32 characters').optional(),

    // Session configuration
    SESSION_TIMEOUT_MINUTES: z.coerce.number().min(5).max(480).default(30),
    SESSION_MAX_LIFETIME_HOURS: z.coerce.number().min(1).max(24).default(8),

    // Feature flags
    ENABLE_OFFLINE_MODE: z.coerce.boolean().default(true),
    ENABLE_AR_MENU: z.coerce.boolean().default(false),
    ENABLE_ANALYTICS: z.coerce.boolean().default(true),
    RATE_LIMIT_ENABLED: z.coerce.boolean().default(true),
    ENABLE_P0_PILOT_ROLLOUT: z.coerce.boolean().default(false),
    ENABLE_P1_PILOT_ROLLOUT: z.coerce.boolean().default(false),
    ENABLE_P2_PILOT_ROLLOUT: z.coerce.boolean().default(false),
    PILOT_RESTAURANT_IDS: z.string().default(''),
    PILOT_BLOCK_MUTATIONS: z.coerce.boolean().default(false),

    // External services (optional)
    CHAPA_SECRET_KEY: z.string().optional(),
    CHAPA_WEBHOOK_SECRET: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    QSTASH_TOKEN: z.string().optional(),
    KDS_PRINTER_WEBHOOK_SECRET: z.string().min(16).optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),

    // Analytics
    NEXT_PUBLIC_GA_ID: z.string().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    // Redis
    REDIS_URL: z.string().optional(),

    // Telegram Alerts (CRIT-08)
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_ALERT_CHAT_ID: z.string().optional(),

    // Staging-specific rate limiting
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().min(1).default(100),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().min(1).default(60),
    RATE_LIMIT_AUTH_MAX_REQUESTS: z.coerce.number().min(1).default(10),
});

/**
 * Server-only environment schema (additional validation for server-side)
 */
const serverEnvSchema = z.object({
    // These should never be exposed to client
    SUPABASE_SECRET_KEY: z.string().optional(),
    DATABASE_URL: z.string().optional(),
    DATABASE_DIRECT_URL: z.string().optional(),
    SUPABASE_POOLER_URL: z.string().optional(),
    SUPABASE_DB_URL: z.string().optional(),
    POWERSYNC_DATABASE_URL: z.string().optional(),
    JWT_SECRET: z.string().optional(),
    HMAC_SECRET: z.string().optional(),
    CHAPA_SECRET_KEY: z.string().optional(),
    CHAPA_WEBHOOK_SECRET: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    QSTASH_TOKEN: z.string().optional(),
    KDS_PRINTER_WEBHOOK_SECRET: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    REDIS_URL: z.string().optional(),
});

/**
 * Parsed and validated environment configuration
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Rate limit configuration based on environment
 */
export interface EnvironmentRateLimitConfig {
    maxRequests: number;
    windowSeconds: number;
    authMaxRequests: number;
}

/**
 * Get rate limit configuration based on current environment
 * Staging has more permissive limits for testing
 */
export function getRateLimitConfig(): EnvironmentRateLimitConfig {
    const env = getEnv();
    const isStagingEnv = env.NODE_ENV === 'staging';
    const isDevEnv = env.NODE_ENV === 'development';

    // Staging and development have more permissive rate limits
    if (isStagingEnv) {
        return {
            maxRequests: env.RATE_LIMIT_MAX_REQUESTS || 200,
            windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS || 60,
            authMaxRequests: env.RATE_LIMIT_AUTH_MAX_REQUESTS || 20,
        };
    }

    if (isDevEnv) {
        return {
            maxRequests: env.RATE_LIMIT_MAX_REQUESTS || 500,
            windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS || 60,
            authMaxRequests: env.RATE_LIMIT_AUTH_MAX_REQUESTS || 50,
        };
    }

    // Production has stricter rate limits
    return {
        maxRequests: env.RATE_LIMIT_MAX_REQUESTS || 100,
        windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS || 60,
        authMaxRequests: env.RATE_LIMIT_AUTH_MAX_REQUESTS || 10,
    };
}

/**
 * Parse and validate environment variables
 * Throws descriptive errors if validation fails
 */
function parseEnv(): Env {
    // In Next.js, we need to handle both build time and runtime
    const isServer = typeof window === 'undefined';
    const env = isServer ? process.env : (process.env as Record<string, string | undefined>);

    try {
        return envSchema.parse(env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const missingVars = error.issues
                .map(issue => {
                    const path = issue.path.join('.');
                    return `  - ${path}: ${issue.message}`;
                })
                .join('\n');

            // In development, log warning but continue
            if (process.env.NODE_ENV === 'development') {
                logger.warn(
                    '\n⚠️  Environment validation failed:\n' +
                        missingVars +
                        '\n\n' +
                        'Some features may not work correctly.\n'
                );
                // Return with defaults
                return envSchema.parse({
                    ...env,
                    NODE_ENV: 'development',
                });
            }

            // In production, throw error
            throw new Error(
                '\n❌ Environment validation failed:\n' +
                    missingVars +
                    '\n\n' +
                    'Please check your .env.local file and ensure all required variables are set.\n'
            );
        }
        throw error;
    }
}

/**
 * Validate server-only environment variables
 * Should be called in server-side code only
 */
export function validateServerEnv(): void {
    if (typeof window !== 'undefined') {
        throw new Error('validateServerEnv() should only be called on the server');
    }

    try {
        serverEnvSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            logger.warn(
                'Server environment validation warnings:\n' +
                    error.issues
                        .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
                        .join('\n')
            );
        }
    }
}

// Cache parsed env to avoid re-parsing
let cachedEnv: Env | null = null;

/**
 * Get validated environment configuration
 * Memoized to avoid repeated parsing
 */
export function getEnv(): Env {
    if (!cachedEnv) {
        cachedEnv = parseEnv();
    }
    return cachedEnv;
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(
    feature: keyof Pick<
        Env,
        | 'ENABLE_OFFLINE_MODE'
        | 'ENABLE_AR_MENU'
        | 'ENABLE_ANALYTICS'
        | 'RATE_LIMIT_ENABLED'
        | 'ENABLE_P0_PILOT_ROLLOUT'
        | 'ENABLE_P1_PILOT_ROLLOUT'
        | 'ENABLE_P2_PILOT_ROLLOUT'
    >
): boolean {
    return getEnv()[feature] ?? false;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
    return getEnv().NODE_ENV === 'production';
}

/**
 * Check if running in staging
 */
export function isStaging(): boolean {
    return getEnv().NODE_ENV === 'staging';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
    return getEnv().NODE_ENV === 'development';
}

/**
 * Check if Redis is configured
 */
export function hasRedis(): boolean {
    return !!getEnv().REDIS_URL;
}

/**
 * Get the app URL with fallback
 * Resolves intelligently on Vercel deployments to prevent local overrides.
 */
export function getAppUrl(): string {
    if (process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV) {
        const vercelUrl =
            process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ||
            process.env.NEXT_PUBLIC_VERCEL_URL ||
            process.env.VERCEL_PROJECT_PRODUCTION_URL ||
            process.env.VERCEL_URL;

        if (vercelUrl) {
            return `https://${vercelUrl}`;
        }
    }
    const envUrl = getEnv().NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return envUrl.replace(/\/$/, '');
}

// Export singleton instance
export const env = getEnv();

export default env;
