/**
 * Startup Secret Validation
 *
 * SEC-006: Validates all required secrets are configured before the application
 * starts accepting traffic. Fails fast with clear, actionable error messages
 * listing every missing or invalid secret.
 *
 * Called from instrumentation.ts or the root layout at app initialization.
 */

interface SecretCheck {
    key: string;
    minLength: number;
    description: string;
    critical: boolean;
}

interface SecretCheckResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

const REQUIRED_SECRETS: SecretCheck[] = [
    {
        key: 'NEXT_PUBLIC_SUPABASE_URL',
        minLength: 10,
        description: 'Supabase project URL',
        critical: true,
    },
    {
        key: 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
        minLength: 20,
        description: 'Supabase publishable (anon) key',
        critical: true,
    },
    {
        key: 'SUPABASE_SECRET_KEY',
        minLength: 40,
        description: 'Supabase service role key',
        critical: true,
    },
    {
        key: 'DEVICE_TOKEN_SIGNATURE_SECRET',
        minLength: 32,
        description: 'HMAC secret for device token cookies',
        critical: true,
    },
    {
        key: 'GATEWAY_SESSION_SECRET',
        minLength: 32,
        description: 'HMAC secret for gateway session tokens',
        critical: true,
    },
    {
        key: 'QR_HMAC_SECRET',
        minLength: 32,
        description: 'HMAC secret for QR code signing',
        critical: true,
    },
    {
        key: 'CHAPA_SECRET_KEY',
        minLength: 20,
        description: 'Chapa payment gateway secret key',
        critical: true,
    },
];

const OPTIONAL_SECRETS: SecretCheck[] = [
    {
        key: 'UPSTASH_REDIS_REST_URL',
        minLength: 10,
        description: 'Upstash Redis REST URL (rate limiting, caching)',
        critical: false,
    },
    {
        key: 'UPSTASH_REDIS_REST_TOKEN',
        minLength: 20,
        description: 'Upstash Redis REST token',
        critical: false,
    },
    {
        key: 'QSTASH_TOKEN',
        minLength: 20,
        description: 'QStash token (background job processing)',
        critical: false,
    },
    {
        key: 'CHAPA_WEBHOOK_SECRET',
        minLength: 16,
        description: 'Chapa webhook HMAC secret',
        critical: false,
    },
    {
        key: 'LOCAL_FISCAL_SIGNING_SECRET',
        minLength: 32,
        description: 'HMAC secret for offline fiscal receipt signing',
        critical: false,
    },
];

const BLOCKED_PATTERNS: { key: string; patterns: RegExp[] }[] = [
    {
        key: 'DEVICE_TOKEN_SIGNATURE_SECRET',
        patterns: [/development-secret/i, /change-in-production/i, /placeholder/i],
    },
    {
        key: 'GATEWAY_SESSION_SECRET',
        patterns: [/development-secret/i, /change-in-production/i, /placeholder/i, /test-gateway/i],
    },
    {
        key: 'QR_HMAC_SECRET',
        patterns: [/development-secret/i, /change-in-production/i, /placeholder/i],
    },
    {
        key: 'CHAPA_SECRET_KEY',
        patterns: [/your_chapa_secret/i, /placeholder/i],
    },
    {
        key: 'SUPABASE_SECRET_KEY',
        patterns: [/your_service_role/i, /placeholder/i, /dummy-secret/i],
    },
];

function validateUrl(key: string, value: string): string | null {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
            return `${key}: invalid protocol "${url.protocol}" (expected https://)`;
        }
        return null;
    } catch {
        return `${key}: invalid URL format (value: "${value.substring(0, 30)}...")`;
    }
}

function validateSecret(
    check: SecretCheck,
    env: Record<string, string | undefined>
): string | null {
    const value = env[check.key];

    if (!value || value.trim() === '') {
        return `${check.key}: missing (${check.description})`;
    }

    const trimmed = value.trim();

    if (trimmed.length < check.minLength) {
        return `${check.key}: too short (${trimmed.length} < ${check.minLength} chars) (${check.description})`;
    }

    const blocked = BLOCKED_PATTERNS.find(b => b.key === check.key);
    if (blocked) {
        for (const pattern of blocked.patterns) {
            if (pattern.test(trimmed)) {
                return `${check.key}: contains placeholder/development value matching "${pattern}" (${check.description})`;
            }
        }
    }

    if (check.key === 'NEXT_PUBLIC_SUPABASE_URL') {
        const urlError = validateUrl(check.key, trimmed);
        if (urlError) return urlError;
    }

    return null;
}

export function validateSecrets(
    envOverrides?: Record<string, string | undefined>
): SecretCheckResult {
    const env = envOverrides ?? (typeof process !== 'undefined' ? process.env : {});
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const check of REQUIRED_SECRETS) {
        const error = validateSecret(check, env);
        if (error) {
            if (check.critical) {
                errors.push(`[CRITICAL] ${error}`);
            } else {
                warnings.push(`[WARNING] ${error}`);
            }
        }
    }

    for (const check of OPTIONAL_SECRETS) {
        const value = env[check.key];
        if (!value || value.trim() === '') {
            if (process.env.NODE_ENV === 'production') {
                warnings.push(`[WARNING] ${check.key}: not configured (${check.description})`);
            }
            continue;
        }

        const error = validateSecret(check, env);
        if (error) {
            warnings.push(`[WARNING] ${error}`);
        }
    }

    const isProduction = env.NODE_ENV === 'production';

    if (isProduction && !env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https://')) {
        errors.push('[CRITICAL] NEXT_PUBLIC_SUPABASE_URL must use https:// in production');
    }

    if (isProduction && !env.NEXT_PUBLIC_APP_URL?.startsWith('https://')) {
        warnings.push('[WARNING] NEXT_PUBLIC_APP_URL should use https:// in production');
    }

    if (isProduction && env.SESSION_TIMEOUT_MINUTES) {
        const timeoutMin = parseInt(env.SESSION_TIMEOUT_MINUTES, 10);
        if (timeoutMin < 5 || timeoutMin > 480) {
            warnings.push(
                '[WARNING] SESSION_TIMEOUT_MINUTES should be between 5 and 480 (current: ' +
                    timeoutMin +
                    ')'
            );
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}

/**
 * Assert all secrets are valid. Throws with a detailed message listing
 * all errors if any critical secrets are missing or invalid.
 * Use this at app startup to fail fast.
 */
export function assertSecretsValid(envOverrides?: Record<string, string | undefined>): void {
    const result = validateSecrets(envOverrides);

    if (result.warnings.length > 0) {
        console.warn('[Startup] Secret validation warnings:');
        for (const warning of result.warnings) {
            console.warn('  - ' + warning);
        }
    }

    if (!result.valid) {
        const message =
            '[Startup] CRITICAL: Required secrets are missing or invalid:\n' +
            result.errors.map(e => '  - ' + e).join('\n') +
            '\n\nSet these environment variables and restart the application.\n' +
            'See .env.example for a complete list of required variables.';

        throw new Error(message);
    }
}
