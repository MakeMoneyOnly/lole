/**
 * Custom Application Error Class
 * Used for structured error handling across the application
 */
export class AppError extends Error {
    constructor(
        public statusCode: number,
        public userMessage: string,
        public internalMessage?: string,
        public code?: string
    ) {
        super(userMessage);
        this.name = 'AppError';
    }
}

/**
 * Validation Error
 * Used when input validation fails
 */
export class ValidationError extends AppError {
    constructor(
        userMessage: string = 'Validation failed',
        public details?: Array<{ path: string; message: string }>
    ) {
        super(400, userMessage, undefined, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

/**
 * Authentication Error
 * Used when authentication fails
 */
export class AuthenticationError extends AppError {
    constructor(userMessage: string = 'Authentication required') {
        super(401, userMessage, undefined, 'AUTHENTICATION_ERROR');
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization Error
 * Used when user lacks permission
 */
export class AuthorizationError extends AppError {
    constructor(userMessage: string = 'Access denied') {
        super(403, userMessage, undefined, 'AUTHORIZATION_ERROR');
        this.name = 'AuthorizationError';
    }
}

/**
 * Not Found Error
 * Used when a resource is not found
 */
export class NotFoundError extends AppError {
    constructor(userMessage: string = 'Resource not found') {
        super(404, userMessage, undefined, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

/**
 * Rate Limit Error
 * Used when rate limit is exceeded
 */
export class RateLimitError extends AppError {
    constructor(userMessage: string = 'Too many requests') {
        super(429, userMessage, undefined, 'RATE_LIMIT');
        this.name = 'RateLimitError';
    }
}
