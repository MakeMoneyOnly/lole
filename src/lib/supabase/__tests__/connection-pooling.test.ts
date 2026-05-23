import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    SERVERLESS_POOL_CONFIG,
    LONG_RUNNING_POOL_CONFIG,
    getConnectionPoolConfig,
    getPooledConnectionUrl,
    getDirectConnectionUrl,
    checkPoolHealth,
    getSupabasePoolerConfig,
} from '../connection-pooling';

describe('connection-pooling configuration', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...originalEnv };
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('SERVERLESS_POOL_CONFIG', () => {
        it('should have serverless-appropriate defaults', () => {
            expect(SERVERLESS_POOL_CONFIG.maxConnections).toBe(10);
            expect(SERVERLESS_POOL_CONFIG.minConnections).toBe(0);
            expect(SERVERLESS_POOL_CONFIG.connectionTimeoutMs).toBe(30000);
            expect(SERVERLESS_POOL_CONFIG.idleTimeoutMs).toBe(30000);
            expect(SERVERLESS_POOL_CONFIG.poolMode).toBe('transaction');
            expect(SERVERLESS_POOL_CONFIG.useSupabasePooler).toBe(true);
        });
    });

    describe('LONG_RUNNING_POOL_CONFIG', () => {
        it('should have long-running process appropriate defaults', () => {
            expect(LONG_RUNNING_POOL_CONFIG.maxConnections).toBe(20);
            expect(LONG_RUNNING_POOL_CONFIG.minConnections).toBe(2);
            expect(LONG_RUNNING_POOL_CONFIG.connectionTimeoutMs).toBe(60000);
            expect(LONG_RUNNING_POOL_CONFIG.idleTimeoutMs).toBe(300000);
            expect(LONG_RUNNING_POOL_CONFIG.poolMode).toBe('session');
            expect(LONG_RUNNING_POOL_CONFIG.useSupabasePooler).toBe(true);
        });
    });

    describe('getConnectionPoolConfig', () => {
        it('should return serverless config in Vercel environment', () => {
            process.env.VERCEL = '1';
            const config = getConnectionPoolConfig();
            expect(config).toEqual(SERVERLESS_POOL_CONFIG);
        });

        it('should return serverless config in AWS Lambda environment', () => {
            process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-function';
            const config = getConnectionPoolConfig();
            expect(config).toEqual(SERVERLESS_POOL_CONFIG);
        });

        it('should return serverless config in Netlify environment', () => {
            process.env.NETLIFY = 'true';
            const config = getConnectionPoolConfig();
            expect(config).toEqual(SERVERLESS_POOL_CONFIG);
        });

        it('should return long-running config in other environments', () => {
            delete process.env.VERCEL;
            delete process.env.AWS_LAMBDA_FUNCTION_NAME;
            delete process.env.NETLIFY;

            const config = getConnectionPoolConfig();
            expect(config).toEqual(LONG_RUNNING_POOL_CONFIG);
        });
    });

    describe('getPooledConnectionUrl', () => {
        it('should throw error when no pooler URL is configured', () => {
            delete process.env.DATABASE_URL;
            delete process.env.SUPABASE_POOLER_URL;

            expect(() => getPooledConnectionUrl()).toThrow('DATABASE_URL is not configured');
        });

        it('should return DATABASE_URL when set', () => {
            process.env.DATABASE_URL =
                'postgresql://postgres@test.pooler.supabase.com:6543/postgres';
            expect(getPooledConnectionUrl()).toBe(
                'postgresql://postgres@test.pooler.supabase.com:6543/postgres'
            );
        });

        it('should return SUPABASE_POOLER_URL when DATABASE_URL not set', () => {
            delete process.env.DATABASE_URL;
            process.env.SUPABASE_POOLER_URL =
                'postgresql://postgres@test.pooler.supabase.com:6543/postgres';
            expect(getPooledConnectionUrl()).toBe(
                'postgresql://postgres@test.pooler.supabase.com:6543/postgres'
            );
        });

        it('should throw error when URL points to direct database', () => {
            // The check looks for '@db.' or '.supabase.co:5432'
            // Need .supabase.co (not .supabase.com) with :5432 port
            process.env.DATABASE_URL = 'postgresql://postgres@test.db.supabase.co:5432/postgres';

            expect(() => getPooledConnectionUrl()).toThrow(
                'DATABASE_URL must point to the Supabase pooler, not the direct database host'
            );
        });

        it('should throw error when URL points to direct database on 5432 port', () => {
            // The check also looks for any URL with .supabase.co:5432
            process.env.DATABASE_URL = 'postgresql://postgres@test.supabase.co:5432/postgres';

            expect(() => getPooledConnectionUrl()).toThrow(
                'DATABASE_URL must point to the Supabase pooler, not the direct database host'
            );
        });

        it('should throw error when URL points to pooler port but wrong host format', () => {
            process.env.DATABASE_URL = 'postgresql://postgres@test.supabase.co:5432/postgres';

            expect(() => getPooledConnectionUrl()).toThrow(
                'DATABASE_URL must point to the Supabase pooler, not the direct database host'
            );
        });
    });

    describe('getDirectConnectionUrl', () => {
        it('should throw error when no direct URL is configured', () => {
            delete process.env.DATABASE_DIRECT_URL;
            delete process.env.SUPABASE_DB_URL;

            expect(() => getDirectConnectionUrl()).toThrow('DATABASE_DIRECT_URL is not configured');
        });

        it('should return DATABASE_DIRECT_URL when set', () => {
            process.env.DATABASE_DIRECT_URL =
                'postgresql://postgres@test.db.supabase.com:5432/postgres';
            expect(getDirectConnectionUrl()).toBe(
                'postgresql://postgres@test.db.supabase.com:5432/postgres'
            );
        });

        it('should return SUPABASE_DB_URL when DATABASE_DIRECT_URL not set', () => {
            delete process.env.DATABASE_DIRECT_URL;
            process.env.SUPABASE_DB_URL =
                'postgresql://postgres@test.db.supabase.com:5432/postgres';
            expect(getDirectConnectionUrl()).toBe(
                'postgresql://postgres@test.db.supabase.com:5432/postgres'
            );
        });

        it('should throw error when URL points to pooler', () => {
            process.env.DATABASE_DIRECT_URL =
                'postgresql://postgres@test.pooler.supabase.com:6543/postgres';

            expect(() => getDirectConnectionUrl()).toThrow(
                'DATABASE_DIRECT_URL must point to the direct database host, not the Supabase pooler'
            );
        });

        it('should throw error when URL contains pooler in host', () => {
            process.env.DATABASE_DIRECT_URL =
                'postgresql://postgres@pooler.test.supabase.com:5432/postgres';

            expect(() => getDirectConnectionUrl()).toThrow(
                'DATABASE_DIRECT_URL must point to the direct database host, not the Supabase pooler'
            );
        });
    });

    describe('checkPoolHealth', () => {
        it('should return unhealthy status when service role client creation fails', async () => {
            // When service role client can't be created, checkPoolHealth catches the error
            // and returns unhealthy status
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.SUPABASE_SECRET_KEY;

            const status = await checkPoolHealth();
            expect(status.healthy).toBe(false);
            expect(status.activeConnections).toBe(-1);
        });

        it('should handle pool health check errors gracefully', async () => {
            // Test that the function handles errors without throwing
            const status = await checkPoolHealth();
            expect(status).toHaveProperty('healthy');
            expect(status).toHaveProperty('lastChecked');
        });
    });

    describe('getSupabasePoolerConfig', () => {
        it('should return config with transaction mode for serverless', () => {
            process.env.VERCEL = '1';
            const config = getSupabasePoolerConfig();

            expect(config.db.schema).toBe('public');
            expect(config.auth.autoRefreshToken).toBe(true);
            expect(config.auth.persistSession).toBe(false);
            expect(config.global.headers['x-connection-mode']).toBe('transaction');
        });

        it('should return config with session mode for long-running', () => {
            delete process.env.VERCEL;
            delete process.env.AWS_LAMBDA_FUNCTION_NAME;
            delete process.env.NETLIFY;

            const config = getSupabasePoolerConfig();
            expect(config.global.headers['x-connection-mode']).toBe('session');
        });
    });
});
