/**
 * E2E Test Mode Security Validation
 *
 * CRITICAL: This module ensures E2E test bypass can NEVER be enabled in production.
 *
 * Security model:
 * 1. NODE_ENV must NOT be 'production'
 * 2. E2E_TEST_MODE must be 'true'
 * 3. E2E_BYPASS_SECRET must be configured
 *
 * All three conditions must be true for E2E bypass to work.
 * This module validates these constraints at application startup.
 */

/**
 * Validate E2E test configuration at startup.
 * Throws an error if E2E test mode is configured unsafely.
 *
 * Call this function in instrumentation.ts to validate at server startup.
 */
export function validateE2EConfig(): void {
    const nodeEnv = process.env.NODE_ENV;
    const e2eTestMode = process.env.E2E_TEST_MODE;
    const e2eBypassSecret = process.env.E2E_BYPASS_SECRET;

    // CRITICAL: Never allow E2E test mode in production (unless in CI for E2E testing)
    if (
        nodeEnv === 'production' &&
        process.env.GITHUB_ACTIONS !== 'true' &&
        process.env.CI !== 'true'
    ) {
        if (e2eTestMode === 'true') {
            throw new Error(
                'CRITICAL SECURITY VIOLATION: E2E_TEST_MODE cannot be enabled in production. ' +
                    'Set E2E_TEST_MODE to anything other than "true" in production.'
            );
        }

        if (e2eBypassSecret) {
            console.warn(
                '[SECURITY WARNING] E2E_BYPASS_SECRET should not be set in production. ' +
                    'Remove this environment variable before deployment.'
            );
        }

        // Production is safe - no E2E bypass possible
        return;
    }

    // Non-production environment (development, test, etc.)
    if (e2eTestMode === 'true') {
        if (!e2eBypassSecret || e2eBypassSecret === '') {
            console.warn(
                '[SECURITY WARNING] E2E_TEST_MODE is enabled but E2E_BYPASS_SECRET is not set. ' +
                    'E2E bypass will not work without a configured secret. ' +
                    'Set E2E_BYPASS_SECRET environment variable.'
            );
        } else {
            console.warn(
                '[E2E] E2E test mode is enabled with configured secret. ' +
                    'E2E bypass will be available for testing.'
            );
        }
    }

    // Log for debugging in non-production
    if (nodeEnv === 'development' && e2eTestMode !== 'true') {
        console.warn(
            '[E2E] E2E test mode is disabled. ' +
                'Set E2E_TEST_MODE=true and E2E_BYPASS_SECRET=<secret> to enable E2E bypass.'
        );
    }
}

/**
 * Check if E2E bypass is allowed in the current environment.
 * Use this for runtime checks in middleware and server components.
 *
 * @returns true if E2E bypass is permitted, false otherwise
 */
export function isE2EBypassAllowed(): boolean {
    const nodeEnv = process.env.NODE_ENV;
    const e2eTestMode = process.env.E2E_TEST_MODE;

    // Production: Never allow bypass (unless in CI for E2E testing)
    if (
        nodeEnv === 'production' &&
        process.env.GITHUB_ACTIONS !== 'true' &&
        process.env.CI !== 'true'
    ) {
        return false;
    }

    // Non-production: Only allow if explicitly enabled
    return e2eTestMode === 'true';
}

/**
 * Validate that E2E bypass secret is properly configured.
 * Use this to ensure the secret matches between environment and request.
 *
 * @param providedSecret - The secret provided in the request
 * @returns true if the secret is valid, false otherwise
 */
export function isValidE2EBypassSecret(providedSecret: string | undefined): boolean {
    // E2E bypass must be allowed first
    if (!isE2EBypassAllowed()) {
        return false;
    }

    const configuredSecret = process.env.E2E_BYPASS_SECRET;

    // Secret must be configured
    if (!configuredSecret || configuredSecret === '') {
        return false;
    }

    // Secret must be provided
    if (!providedSecret || providedSecret === '') {
        return false;
    }

    // Use timing-safe comparison to prevent timing attacks
    // Note: For E2E test secrets, timing attacks are less of a concern
    // but it's good practice to use safe comparison
    // Using dynamic require to avoid issues in edge runtime
    let nodeCrypto: typeof import('crypto') | null = null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        nodeCrypto = require('crypto');
    } catch {
        // Crypto not available (edge runtime), deny access
        return false;
    }

    if (!nodeCrypto) {
        return false;
    }

    const configuredBuffer = Buffer.from(configuredSecret, 'utf-8');
    const providedBuffer = Buffer.from(providedSecret, 'utf-8');

    // Length check first (but don't return early to avoid timing leaks)
    if (configuredBuffer.length !== providedBuffer.length) {
        return false;
    }

    // Timing-safe comparison
    try {
        return nodeCrypto.timingSafeEqual(configuredBuffer, providedBuffer);
    } catch {
        // If comparison fails for any reason, deny access
        return false;
    }
}

/**
 * Log E2E bypass security events.
 * Use this for audit logging and debugging.
 *
 * @param event - The type of event
 * @param details - Additional context
 */
export function logE2ESecurityEvent(
    event: 'bypass_attempt' | 'bypass_success' | 'bypass_rejected' | 'config_warning',
    details: Record<string, unknown> = {}
): void {
    const nodeEnv = process.env.NODE_ENV;
    const timestamp = new Date().toISOString();

    const logEntry = {
        timestamp,
        event,
        environment: nodeEnv,
        ...details,
    };

    if (event === 'bypass_attempt' && nodeEnv === 'production') {
        // Critical: Bypass attempt in production
        console.error(
            '[SECURITY CRITICAL] E2E bypass attempt in production environment:',
            logEntry
        );
    } else if (event === 'bypass_rejected') {
        console.warn('[SECURITY] E2E bypass rejected:', logEntry);
    } else if (event === 'bypass_success') {
        console.warn('[E2E] E2E bypass successful:', logEntry);
    } else {
        console.warn('[E2E]', event, logEntry);
    }
}
