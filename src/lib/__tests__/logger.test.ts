import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, apiLogger, authLogger, dbLogger, webhookLogger } from '@/lib/logger';

describe('Logger', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        warnSpy.mockRestore();
        errorSpy.mockRestore();
        vi.unstubAllEnvs();
    });

    describe('singleton', () => {
        it('exported logger is a stable object reference', () => {
            expect(logger).toBeDefined();
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.warn).toBe('function');
            expect(typeof logger.error).toBe('function');
            expect(typeof logger.debug).toBe('function');
            expect(typeof logger.child).toBe('function');
            expect(typeof logger.generateRequestId).toBe('function');
        });
    });

    describe('child', () => {
        it('creates a new logger with a different source', () => {
            const child = logger.child('test-source');
            expect(child).not.toBe(logger);

            child.info('child message');
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const call = warnSpy.mock.calls[0];
            expect(call[0]).toContain('[test-source]');
        });

        it('child logger retains independent source from parent', () => {
            const child = logger.child('child-ctx');
            logger.info('parent msg');
            child.info('child msg');
            expect(warnSpy).toHaveBeenCalledTimes(2);
            expect(warnSpy.mock.calls[0][0]).toContain('[app]');
            expect(warnSpy.mock.calls[1][0]).toContain('[child-ctx]');
        });
    });

    describe('generateRequestId', () => {
        it('returns a string containing a dash and random segment', () => {
            const id = logger.generateRequestId();
            expect(typeof id).toBe('string');
            expect(id).toMatch(/^\d+-[a-z0-9]+$/);
        });

        it('generates unique ids on successive calls', () => {
            const id1 = logger.generateRequestId();
            const id2 = logger.generateRequestId();
            expect(id1).not.toBe(id2);
        });
    });

    describe('debug', () => {
        it('logs when NODE_ENV is development', () => {
            vi.stubEnv('NODE_ENV', 'development');
            logger.debug('debug msg', { key: 'val' });
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const call = warnSpy.mock.calls[0];
            expect(call[0]).toContain('DEBUG');
            expect(call[1]).toBe('debug msg');
        });

        it('does not log when NODE_ENV is not development', () => {
            vi.stubEnv('NODE_ENV', 'production');
            logger.debug('debug msg', { key: 'val' });
            expect(warnSpy).not.toHaveBeenCalled();
        });
    });

    describe('info', () => {
        it('logs with console.warn and includes INFO level', () => {
            logger.info('info msg');
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const call = warnSpy.mock.calls[0];
            expect(call[0]).toContain('INFO');
            expect(call[1]).toBe('info msg');
        });

        it('includes context in the log output', () => {
            logger.info('info msg', { foo: 'bar' });
            const call = warnSpy.mock.calls[0];
            const logData = call[2];
            expect(logData).toEqual({ foo: 'bar' });
        });

        it('includes requestId in prefix when provided', () => {
            logger.info('info msg', undefined, 'req-123');
            const call = warnSpy.mock.calls[0];
            expect(call[0]).toContain('req-123');
        });

        it('omits requestId from prefix when not provided', () => {
            logger.info('info msg');
            const call = warnSpy.mock.calls[0];
            expect(call[0]).not.toMatch(/\[req-/);
        });
    });

    describe('warn', () => {
        it('logs with console.warn and includes WARN level', () => {
            logger.warn('warn msg');
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const call = warnSpy.mock.calls[0];
            expect(call[0]).toContain('WARN');
            expect(call[1]).toBe('warn msg');
        });

        it('includes context when provided', () => {
            logger.warn('warn msg', { detail: 'something' });
            const call = warnSpy.mock.calls[0];
            expect(call[2]).toEqual({ detail: 'something' });
        });
    });

    describe('error', () => {
        it('logs Error instance with name, message, and stack', () => {
            const err = new Error('test error');
            logger.error('error msg', err);
            expect(errorSpy).toHaveBeenCalledTimes(1);
            const call = errorSpy.mock.calls[0];
            expect(call[0]).toContain('ERROR');
            expect(call[1]).toBe('error msg');
            const logData = call[2] as Record<string, unknown>;
            const errorObj = logData.error as Record<string, unknown>;
            expect(errorObj.name).toBe('Error');
            expect(errorObj.message).toBe('test error');
            expect(errorObj.stack).toBeDefined();
        });

        it('logs non-Error defined value as error context', () => {
            logger.error('error msg', 'string-error');
            expect(errorSpy).toHaveBeenCalledTimes(1);
            const call = errorSpy.mock.calls[0];
            const logData = call[2] as Record<string, unknown>;
            expect(logData.error).toBe('string-error');
        });

        it('logs with undefined error param without error key in context', () => {
            logger.error('error msg', undefined);
            expect(errorSpy).toHaveBeenCalledTimes(1);
            const call = errorSpy.mock.calls[0];
            const logData = call[2] as Record<string, unknown>;
            expect(logData.error).toBeUndefined();
        });

        it('merges provided context with error context', () => {
            logger.error('error msg', new Error('boom'), { extraKey: 'extraVal' });
            const call = errorSpy.mock.calls[0];
            const logData = call[2] as Record<string, unknown>;
            expect(logData.extraKey).toBe('extraVal');
            expect(logData.error).toBeDefined();
        });

        it('includes requestId when provided', () => {
            logger.error('error msg', undefined, undefined, 'req-456');
            const call = errorSpy.mock.calls[0];
            expect(call[0]).toContain('req-456');
        });
    });

    describe('logApiRequest', () => {
        it('logs with info level including method and path', () => {
            logger.logApiRequest('GET', '/api/v1/merchant/operations/orders');
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const call = warnSpy.mock.calls[0];
            expect(call[0]).toContain('INFO');
            expect(call[1]).toBe('API Request: GET /api/v1/merchant/operations/orders');
        });
    });

    describe('logApiResponse', () => {
        it('logs error level when statusCode >= 400', () => {
            logger.logApiResponse('POST', '/api/v1/merchant/operations/orders', 500, 120);
            expect(errorSpy).toHaveBeenCalledTimes(1);
            const call = errorSpy.mock.calls[0];
            expect(call[0]).toContain('ERROR');
            expect(call[1]).toContain('500');
            expect(call[1]).toContain('120ms');
        });

        it('logs warn level when statusCode >= 300 and < 400', () => {
            logger.logApiResponse('GET', '/api/v1/system/redirect', 301, 50);
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const call = warnSpy.mock.calls[0];
            expect(call[0]).toContain('WARN');
            expect(call[1]).toContain('301');
        });

        it('logs info level when statusCode < 300', () => {
            logger.logApiResponse('GET', '/api/v1/merchant/operations/orders', 200, 30);
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const call = warnSpy.mock.calls[0];
            expect(call[0]).toContain('INFO');
            expect(call[1]).toContain('200');
        });
    });

    describe('logUserAction', () => {
        it('logs user action with info level including userId', () => {
            logger.logUserAction('login', 'user-1');
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const call = warnSpy.mock.calls[0];
            expect(call[0]).toContain('INFO');
            expect(call[1]).toBe('User Action: login');
            const logData = call[2] as Record<string, unknown>;
            expect(logData.userId).toBe('user-1');
        });
    });

    describe('logPerformance', () => {
        it('logs performance metric with info level', () => {
            logger.logPerformance('db_query', 42.5, 'ms');
            expect(warnSpy).toHaveBeenCalledTimes(1);
            const call = warnSpy.mock.calls[0];
            expect(call[0]).toContain('INFO');
            expect(call[1]).toBe('Performance: db_query');
            const logData = call[2] as Record<string, unknown>;
            expect(logData.value).toBe(42.5);
            expect(logData.unit).toBe('ms');
        });

        it('defaults unit to ms when not provided', () => {
            logger.logPerformance('render', 16);
            const call = warnSpy.mock.calls[0];
            const logData = call[2] as Record<string, unknown>;
            expect(logData.unit).toBe('ms');
        });
    });

    describe('exported child loggers', () => {
        it('apiLogger has source "api"', () => {
            apiLogger.info('test');
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls[0][0]).toContain('[api]');
        });

        it('authLogger has source "auth"', () => {
            authLogger.info('test');
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls[0][0]).toContain('[auth]');
        });

        it('dbLogger has source "database"', () => {
            dbLogger.info('test');
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls[0][0]).toContain('[database]');
        });

        it('webhookLogger has source "webhook"', () => {
            webhookLogger.info('test');
            expect(warnSpy).toHaveBeenCalledTimes(1);
            expect(warnSpy.mock.calls[0][0]).toContain('[webhook]');
        });
    });
});
