/**
 * Structured Logging Library
 *
 * LOW-013: Implement structured logging for consistent log format
 * Provides JSON-formatted logs for log aggregation and analysis
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
    /** Request ID for tracing */
    requestId?: string;
    /** User ID */
    userId?: string;
    /** Restaurant ID for multi-tenant context */
    restaurantId?: string;
    /** Operation being performed */
    operation?: string;
    /** Additional metadata */
    [key: string]: unknown;
}

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    context?: LogContext;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    duration?: number;
    environment: string;
    service: string;
    version: string;
}

/**
 * Logger configuration
 */
interface LoggerConfig {
    service: string;
    version: string;
    environment: string;
    minLevel: LogLevel;
    includeStackTraces: boolean;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4,
};

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
    service: process.env.NEXT_PUBLIC_APP_NAME || 'lole-api',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    minLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
    includeStackTraces: process.env.NODE_ENV !== 'production',
};

/**
 * Structured Logger Class
 */
export class Logger {
    private config: LoggerConfig;
    private defaultContext: LogContext;

    constructor(config: Partial<LoggerConfig> = {}, defaultContext: LogContext = {}) {
        this.config = { ...defaultConfig, ...config };
        this.defaultContext = defaultContext;
    }

    /**
     * Create a child logger with additional context
     */
    child(context: LogContext): Logger {
        return new Logger(this.config, { ...this.defaultContext, ...context });
    }

    /**
     * Log at debug level
     */
    debug(message: string, context?: LogContext): void {
        this.log('debug', message, context);
    }

    /**
     * Log at info level
     */
    info(message: string, context?: LogContext): void {
        this.log('info', message, context);
    }

    /**
     * Log at warn level
     */
    warn(message: string, context?: LogContext): void {
        this.log('warn', message, context);
    }

    /**
     * Log at error level
     */
    error(message: string, error?: Error | unknown, context?: LogContext): void {
        this.log('error', message, context, error);
    }

    /**
     * Log at fatal level
     */
    fatal(message: string, error?: Error | unknown, context?: LogContext): void {
        this.log('fatal', message, context, error);
    }

    /**
     * Time an operation and log the duration
     */
    time<T>(operation: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
        const start = Date.now();
        const operationContext = { ...context, operation };

        return fn()
            .then(result => {
                const duration = Date.now() - start;
                this.info(`${operation} completed`, { ...operationContext, duration });
                return result;
            })
            .catch(error => {
                const duration = Date.now() - start;
                this.error(`${operation} failed`, error, { ...operationContext, duration });
                throw error;
            });
    }

    /**
     * Create a timer for manual timing
     */
    startTimer(operation: string, context?: LogContext): () => number {
        const start = Date.now();
        const operationContext = { ...context, operation };

        return () => {
            const duration = Date.now() - start;
            this.info(`${operation} completed`, { ...operationContext, duration });
            return duration;
        };
    }

    /**
     * Internal log method
     */
    private log(
        level: LogLevel,
        message: string,
        context?: LogContext,
        error?: Error | unknown
    ): void {
        // Check if level is enabled
        if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.config.minLevel]) {
            return;
        }

        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            context: { ...this.defaultContext, ...context },
            environment: this.config.environment,
            service: this.config.service,
            version: this.config.version,
        };

        // Add error details if provided
        if (error instanceof Error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: this.config.includeStackTraces ? error.stack : undefined,
            };
        } else if (error) {
            entry.error = {
                name: 'UnknownError',
                message: String(error),
            };
        }

        // Output based on environment
        if (this.config.environment === 'production') {
            // JSON format for production (log aggregation)
            this.outputJson(entry);
        } else {
            // Human-readable format for development
            this.outputPretty(entry);
        }
    }

    /**
     * Output JSON format for production
     */
    private outputJson(entry: LogEntry): void {
        const output = JSON.stringify(entry);
        switch (entry.level) {
            case 'fatal':
            case 'error':
                console.error(output);
                break;
            case 'warn':
                console.warn(output);
                break;
            default:
                console.warn(output);
        }
    }

    /**
     * Output human-readable format for development
     */
    private outputPretty(entry: LogEntry): void {
        const timestamp = entry.timestamp.split('T')[1].split('.')[0];
        const level = entry.level.toUpperCase().padEnd(5);
        const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
        const error = entry.error
            ? `\n  ${entry.error.name}: ${entry.error.message}${entry.error.stack ? `\n  ${entry.error.stack}` : ''}`
            : '';

        const output = `[${timestamp}] ${level} | ${entry.message}${context}${error}`;

        switch (entry.level) {
            case 'fatal':
            case 'error':
                console.error('\x1b[31m%s\x1b[0m', output);
                break;
            case 'warn':
                console.warn('\x1b[33m%s\x1b[0m', output);
                break;
            case 'debug':
                console.warn('\x1b[90m%s\x1b[0m', output);
                break;
            default:
                console.warn('\x1b[36m%s\x1b[0m', output);
        }
    }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a logger with request context
 */
export function createRequestLogger(requestId: string, context?: LogContext): Logger {
    return logger.child({ requestId, ...context });
}

/**
 * Create a logger with user context
 */
export function createUserLogger(userId: string, context?: LogContext): Logger {
    return logger.child({ userId, ...context });
}

/**
 * Create a logger with tenant context
 */
export function createTenantLogger(restaurantId: string, context?: LogContext): Logger {
    return logger.child({ restaurantId, ...context });
}

/**
 * Log an API request
 */
export function logApiRequest(method: string, path: string, context?: LogContext): void {
    logger.info(`API Request: ${method} ${path}`, {
        operation: 'api_request',
        method,
        path,
        ...context,
    });
}

/**
 * Log an API response
 */
export function logApiResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    context?: LogContext
): void {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logger[level](`API Response: ${method} ${path} ${statusCode}`, {
        operation: 'api_response',
        method,
        path,
        statusCode,
        duration,
        ...context,
    });
}

/**
 * Log a database operation
 */
export function logDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    context?: LogContext
): void {
    logger.debug(`Database: ${operation} on ${table}`, {
        operation: 'database',
        dbOperation: operation,
        table,
        duration,
        ...context,
    });
}

/**
 * Log a payment operation
 */
export function logPaymentOperation(
    operation: string,
    provider: string,
    amount: number,
    currency: string,
    context?: LogContext
): void {
    logger.info(`Payment: ${operation} via ${provider}`, {
        operation: 'payment',
        paymentOperation: operation,
        provider,
        amount,
        currency,
        ...context,
    });
}

// Export default logger
export default logger;
