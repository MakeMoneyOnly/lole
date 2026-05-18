/**
 * Security Module Barrel Export
 *
 * Provides centralized exports for all security utilities
 */

// CSRF Protection
export {
    generateCsrfToken,
    setCsrfToken,
    validateCsrfToken,
    withCsrfProtection,
    getCsrfInput,
    regenerateCsrfToken,
    clearCsrfToken,
} from './csrf';

// Rate Limiting (Database-backed)
export {
    rateLimiters,
    createRateLimitMiddleware,
    withRateLimit,
    checkRateLimit,
    logRateLimitedRequest,
    cleanupRateLimitLogs,
    getClientIdentifier,
    RATE_LIMIT_CONFIGS,
    type RateLimitConfig,
} from './rateLimiter';

// Rate Limiting (Redis-backed - sliding window)
export {
    redisRateLimiters,
    createRedisRateLimitMiddleware,
    withRedisRateLimit,
    checkRedisRateLimit,
    getRedisRateLimiterClient,
    getClientIp,
    getAuthenticatedUserId,
    checkServerActionRateLimit,
    REDIS_RATE_LIMIT_CONFIGS,
    type RedisRateLimitConfig,
    type RedisRateLimitResult,
} from './rateLimiterRedis';

// HMAC Signing
export {
    generateQRSignature,
    verifyQRSignature,
    generateSignedQRCode,
    verifySignedQRCode,
    // Session-specific HMAC
    generateHmacSecret,
    signPayload,
    verifySignature,
    signWithMasterSecret,
    verifyMasterSignature,
} from './hmac';

// Guest Context
export {
    resolveGuestContext,
    GuestContextSchema,
    type GuestContextInput,
    type ResolvedGuestContext,
} from './guestContext';

// Session Management
export { createSession, validateSession, destroySession } from './session';

// Security Events
export { logSecurityEvent, type SecurityEvent } from './securityEvents';

// Password Policy
export { validatePassword } from './passwordPolicy';

// Confirmation Token
export { generateConfirmationToken, type ConfirmationToken } from './confirmationToken';

// Environment Validation
export { getRequiredEnvVar } from './validateEnv';

// Startup Secret Validation
export { validateSecrets, assertSecretsValid } from './startup-checks';
