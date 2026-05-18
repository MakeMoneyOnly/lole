/**
 * Environment Variable Validation
 *
 * Validates required environment variables at startup to fail fast
 * if any critical configuration is missing.
 */

export interface EnvValidationResult {
    valid: boolean;
    missing: string[];
    warnings: string[];
}

/**
 * Required environment variables for security
 */
const REQUIRED_SECURITY_VARS = [
    'QR_HMAC_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SECRET_KEY',
] as const;

/**
 * Optional but recommended environment variables
 */
const RECOMMENDED_VARS = [] as const;

/**
 * Validate security-critical environment variables
 * Call this at application startup to fail fast on missing configuration
 */
export function validateSecurityEnvVars(): EnvValidationResult {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    for (const varName of REQUIRED_SECURITY_VARS) {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    }

    // Check recommended variables
    for (const varName of RECOMMENDED_VARS) {
        if (!process.env[varName]) {
            warnings.push(`${varName} is not set - some features may not work`);
        }
    }

    return {
        valid: missing.length === 0,
        missing,
        warnings,
    };
}

/**
 * Validate all required environment variables and throw if any are missing
 * Use this in server-side initialization to ensure configuration is complete
 */
export function requireEnvVars(): void {
    // During build time, do not throw for missing environment variables
    // as they may be injected at runtime or handled via fallbacks
    if (process.env.NEXT_PHASE === 'phase-production-build') {
        const result = validateSecurityEnvVars();
        if (result.warnings.length > 0) {
            console.warn('Build-time environment warnings:\n' + result.warnings.join('\n'));
        }
        return;
    }

    const result = validateSecurityEnvVars();

    if (!result.valid) {
        throw new Error(
            `Missing required environment variables: ${result.missing.join(', ')}\n` +
                'Please check your .env.local file and ensure all required variables are set.'
        );
    }

    // Log warnings in development
    if (process.env.NODE_ENV === 'development' && result.warnings.length > 0) {
        console.warn('Environment warnings:\n' + result.warnings.join('\n'));
    }
}

/**
 * Get environment variable with type safety
 * Throws if the variable is not set
 */
export function getRequiredEnvVar(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Required environment variable ${name} is not set`);
    }
    return value;
}

/**
 * Get environment variable with fallback
 * Returns the fallback if the variable is not set
 */
export function getEnvVar(name: string, fallback: string): string {
    return process.env[name] || fallback;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
}
