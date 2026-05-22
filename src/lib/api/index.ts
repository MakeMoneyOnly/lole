/**
 * API Module Barrel Export
 *
 * Provides centralized exports for all API utilities
 */

// Versioning
export {
    API_VERSION,
    API_VERSION_HEADER,
    API_DEFAULT_HEADER,
    SUPPORTED_API_VERSIONS,
    detectApiVersion,
    parseVersionFromHeader,
    hasExplicitVersionHeader,
    getVersionedHeaders,
    getDeprecationHeaders,
    getApiVersionInfo,
    processApiVersion,
    isSupportedVersion,
    getLatestVersion,
} from './versioning';
export type { SupportedApiVersion, ApiVersionInfo, VersionMiddlewareResult } from './versioning';

// Response Helpers
export { apiSuccess, apiError, handleApiError } from './response';
export type { ApiErrorResponse } from './response';

// Error Classes (MED-021)
export {
    AppError,
    ValidationError,
    UnauthorizedError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    RateLimitError,
    InternalError,
    ERROR_STATUS_MAP,
    type ErrorCode,
} from './errors';

// Error Factory Functions (MED-021)
export {
    notFound,
    validationErrorFromZod,
    validationError,
    unauthorized,
    forbidden,
    conflict,
    rateLimited,
    internalError,
} from './errors';

// Error Type Guards (MED-021)
export {
    isAppError,
    isValidationError,
    isUnauthorizedError,
    isForbiddenError,
    isNotFoundError,
    isConflictError,
    isRateLimitError,
    toAppError,
} from './errors';

// Error Handling (HIGH-023)
export {
    withErrorHandling,
    withApiErrorHandler,
    validationError as validationErrorResponse,
    authenticationError,
    authorizationError,
    notFoundError as notFoundErrorResponse,
    rateLimitError as rateLimitErrorResponse,
    extractRequestContext,
} from './error-handler';
export type { RequestContext } from './error-handler';

// Authorization
export { getDeviceContext } from './authz';

// Idempotency
export { isIdempotencyKeyValid, resolveIdempotencyKey } from './idempotency';

// Metrics
export { trackApiMetric } from './metrics';

// Pilot Gate
export { enforcePilotAccess } from './pilotGate';

// Request Origin
export { getRequestOrigin } from './requestOrigin';

// Validation
export { parseQuery } from './validation';

// Rate Limit Policies
export { resolveRateLimitPolicy, API_RATE_LIMIT_POLICIES } from './rateLimitPolicies';
export type { RouteRateLimitPolicy } from './rateLimitPolicies';

// Audit
export { writeAuditLog } from './audit';

// Middleware
export {
    withValidation,
    withErrorHandler,
    parseQueryParams,
    parsePathParams,
    checkRateLimitMiddleware,
} from './middleware';
