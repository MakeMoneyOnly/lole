/**
 * Centralized Logging Utility
 *
 * Addresses: Missing Centralized Error Logging (P2 Audit Finding #11)
 * Provides structured logging with levels and context tracking
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
    [key: string]: unknown;
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    context?: LogContext;
    timestamp: string;
    requestId?: string;
    source?: string;
}

class Logger {
    private static instance: Logger;
    private source: string = 'app';

    private constructor() {}

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Create a child logger with a specific source context
     */
    child(source: string): Logger {
        const childLogger = new Logger();
        childLogger.source = source;
        return childLogger;
    }

    /**
     * Generate a unique request ID for tracking
     */
    generateRequestId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private formatEntry(
        level: LogLevel,
        message: string,
        context?: LogContext,
        requestId?: string
    ): LogEntry {
        return {
            level,
            message,
            context,
            timestamp: new Date().toISOString(),
            requestId,
            source: this.source,
        };
    }

    /* eslint-disable no-console */
    private logToConsole(entry: LogEntry): void {
        const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.source}]`;
        const requestId = entry.requestId ? ` [${entry.requestId}]` : '';

        const logData = {
            ...entry.context,
            ...(entry.requestId && { requestId: entry.requestId }),
        };

        switch (entry.level) {
            case 'debug':
                if (process.env.NODE_ENV === 'development') {
                    console.warn(prefix + requestId, entry.message, logData);
                }
                break;
            case 'info':
                console.warn(prefix + requestId, entry.message, logData);
                break;
            case 'warn':
                console.warn(prefix + requestId, entry.message, logData);
                break;
            case 'error':
                console.error(prefix + requestId, entry.message, logData);
                break;
        }
    }
    /* eslint-enable no-console */

    /**
     * Log debug message (only in development)
     */
    debug(message: string, context?: LogContext, requestId?: string): void {
        const entry = this.formatEntry('debug', message, context, requestId);
        this.logToConsole(entry);
    }

    /**
     * Log info message
     */
    info(message: string, context?: LogContext, requestId?: string): void {
        const entry = this.formatEntry('info', message, context, requestId);
        this.logToConsole(entry);
    }

    /**
     * Log warning message
     */
    warn(message: string, context?: LogContext, requestId?: string): void {
        const entry = this.formatEntry('warn', message, context, requestId);
        this.logToConsole(entry);
    }

    /**
     * Log error message with optional error object
     */
    error(
        message: string,
        error?: Error | unknown,
        context?: LogContext,
        requestId?: string
    ): void {
        const errorContext: LogContext = {
            ...context,
        };

        if (error instanceof Error) {
            errorContext.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        } else if (error !== undefined) {
            errorContext.error = error;
        }

        const entry = this.formatEntry('error', message, errorContext, requestId);
        this.logToConsole(entry);

        // TODO: Send to external error tracking service (Sentry, LogRocket, etc.)
        // if (process.env.NODE_ENV === 'production') {
        //     this.sendToErrorTracking(entry);
        // }
    }

    /**
     * Log API request/response
     */
    logApiRequest(method: string, path: string, context?: LogContext, requestId?: string): void {
        this.info(`API Request: ${method} ${path}`, context, requestId);
    }

    logApiResponse(
        method: string,
        path: string,
        statusCode: number,
        duration: number,
        context?: LogContext,
        requestId?: string
    ): void {
        const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
        const message = `API Response: ${method} ${path} - ${statusCode} (${duration}ms)`;

        const entry = this.formatEntry(level, message, context, requestId);
        this.logToConsole(entry);
    }

    /**
     * Log user action for audit trail
     */
    logUserAction(action: string, userId: string, context?: LogContext, requestId?: string): void {
        this.info(`User Action: ${action}`, { userId, ...context }, requestId);
    }

    /**
     * Log performance metric
     */
    logPerformance(metric: string, value: number, unit: string = 'ms', context?: LogContext): void {
        this.info(`Performance: ${metric}`, { value, unit, ...context });
    }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export child loggers for specific domains
export const apiLogger = logger.child('api');
export const authLogger = logger.child('auth');
export const dbLogger = logger.child('database');
export const webhookLogger = logger.child('webhook');
