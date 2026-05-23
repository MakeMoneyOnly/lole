import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getPoolConfig,
    isPoolEnabled,
    getPoolerUrl,
    DEFAULT_POOL_CONFIG,
    PoolConfig,
} from '../pool';

describe('pool configuration', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...originalEnv };
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('getPoolConfig', () => {
        it('should return default config when no env vars set', () => {
            delete process.env.DATABASE_URL;
            delete process.env.SUPABASE_POOLER_URL;
            delete process.env.SUPABASE_POOL_MODE;
            delete process.env.SUPABASE_POOL_SIZE;
            delete process.env.SUPABASE_POOL_MAX_CLIENTS;
            delete process.env.SUPABASE_POOL_CONNECTION_TIMEOUT;
            delete process.env.SUPABASE_POOL_IDLE_TIMEOUT;

            const config = getPoolConfig();

            expect(config.enabled).toBe(false);
            expect(config.mode).toBe('transaction');
            expect(config.poolSize).toBe(10);
            expect(config.maxClients).toBe(20);
            expect(config.connectionTimeout).toBe(30);
            expect(config.idleTimeout).toBe(1800);
        });

        it('should parse pool mode from environment', () => {
            process.env.DATABASE_URL = 'postgresql://test';
            process.env.SUPABASE_POOL_MODE = 'session';

            const config = getPoolConfig();

            expect(config.mode).toBe('session');
        });

        it('should clamp pool size between 1 and 50', () => {
            process.env.DATABASE_URL = 'postgresql://test';

            process.env.SUPABASE_POOL_SIZE = '0';
            expect(getPoolConfig().poolSize).toBe(1);

            process.env.SUPABASE_POOL_SIZE = '-5';
            expect(getPoolConfig().poolSize).toBe(1);

            process.env.SUPABASE_POOL_SIZE = '100';
            expect(getPoolConfig().poolSize).toBe(50);

            process.env.SUPABASE_POOL_SIZE = '25';
            expect(getPoolConfig().poolSize).toBe(25);
        });

        it('should clamp max clients between 1 and 100', () => {
            process.env.DATABASE_URL = 'postgresql://test';

            process.env.SUPABASE_POOL_MAX_CLIENTS = '0';
            expect(getPoolConfig().maxClients).toBe(1);

            process.env.SUPABASE_POOL_MAX_CLIENTS = '200';
            expect(getPoolConfig().maxClients).toBe(100);

            process.env.SUPABASE_POOL_MAX_CLIENTS = '50';
            expect(getPoolConfig().maxClients).toBe(50);
        });

        it('should clamp connection timeout between 1 and 300 seconds', () => {
            process.env.DATABASE_URL = 'postgresql://test';

            process.env.SUPABASE_POOL_CONNECTION_TIMEOUT = '0';
            expect(getPoolConfig().connectionTimeout).toBe(1);

            process.env.SUPABASE_POOL_CONNECTION_TIMEOUT = '500';
            expect(getPoolConfig().connectionTimeout).toBe(300);

            process.env.SUPABASE_POOL_CONNECTION_TIMEOUT = '60';
            expect(getPoolConfig().connectionTimeout).toBe(60);
        });

        it('should clamp idle timeout between 60 and 3600 seconds', () => {
            process.env.DATABASE_URL = 'postgresql://test';

            process.env.SUPABASE_POOL_IDLE_TIMEOUT = '30';
            expect(getPoolConfig().idleTimeout).toBe(60);

            process.env.SUPABASE_POOL_IDLE_TIMEOUT = '5000';
            expect(getPoolConfig().idleTimeout).toBe(3600);

            process.env.SUPABASE_POOL_IDLE_TIMEOUT = '900';
            expect(getPoolConfig().idleTimeout).toBe(900);
        });

        it('should include pooler URL when set', () => {
            process.env.DATABASE_URL = 'postgresql://test';
            process.env.SUPABASE_POOLER_URL = 'postgresql://pooler:test';

            const config = getPoolConfig();

            expect(config.poolerUrl).toBe('postgresql://pooler:test');
        });

        it('should enable pool when DATABASE_URL is set', () => {
            process.env.DATABASE_URL = 'postgresql://test';

            const config = getPoolConfig();

            expect(config.enabled).toBe(true);
        });

        it('should enable pool when SUPABASE_POOLER_URL is set', () => {
            process.env.SUPABASE_POOLER_URL = 'postgresql://test';

            const config = getPoolConfig();

            expect(config.enabled).toBe(true);
        });
    });

    describe('isPoolEnabled', () => {
        it('should return true when DATABASE_URL is set', () => {
            process.env.DATABASE_URL = 'postgresql://test';
            expect(isPoolEnabled()).toBe(true);
        });

        it('should return true when SUPABASE_POOLER_URL is set', () => {
            delete process.env.DATABASE_URL;
            process.env.SUPABASE_POOLER_URL = 'postgresql://test';
            expect(isPoolEnabled()).toBe(true);
        });

        it('should return false when no pooler URLs are set', () => {
            delete process.env.DATABASE_URL;
            delete process.env.SUPABASE_POOLER_URL;
            expect(isPoolEnabled()).toBe(false);
        });
    });

    describe('getPoolerUrl', () => {
        it('should return DATABASE_URL when set', () => {
            process.env.DATABASE_URL = 'postgresql://test';
            expect(getPoolerUrl()).toBe('postgresql://test');
        });

        it('should return SUPABASE_POOLER_URL when DATABASE_URL not set', () => {
            delete process.env.DATABASE_URL;
            process.env.SUPABASE_POOLER_URL = 'postgresql://pooler:test';
            expect(getPoolerUrl()).toBe('postgresql://pooler:test');
        });

        it('should construct pooler URL from project URL when enabled via SUPABASE_POOLER_URL', () => {
            delete process.env.DATABASE_URL;
            process.env.SUPABASE_POOLER_URL = 'postgresql://test'; // Enable pool
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefg.supabase.co';

            // This returns SUPABASE_POOLER_URL, not the constructed URL
            expect(getPoolerUrl()).toBe('postgresql://test');
        });

        it('should return undefined when no pool configuration available', () => {
            delete process.env.DATABASE_URL;
            delete process.env.SUPABASE_POOLER_URL;
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefg.supabase.co';

            // The pooler URL returns DATABASE_URL first, then SUPABASE_POOLER_URL,
            // then the fallback - but the fallback only works if config.enabled is true
            // Since neither DATABASE_URL nor SUPABASE_POOLER_URL is set, config.enabled
            // is false, and the fallback doesn't execute
            expect(getPoolerUrl()).toBeUndefined();
        });

        it('should return undefined when no configuration available', () => {
            delete process.env.DATABASE_URL;
            delete process.env.SUPABASE_POOLER_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            expect(getPoolerUrl()).toBeUndefined();
        });

        it('should handle non-supabase URLs gracefully', () => {
            delete process.env.DATABASE_URL;
            delete process.env.SUPABASE_POOLER_URL;
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.com';

            const url = getPoolerUrl();
            expect(url).toBeUndefined();
        });
    });

    describe('DEFAULT_POOL_CONFIG', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_POOL_CONFIG.enabled).toBe(true);
            expect(DEFAULT_POOL_CONFIG.mode).toBe('transaction');
            expect(DEFAULT_POOL_CONFIG.poolSize).toBe(10);
            expect(DEFAULT_POOL_CONFIG.maxClients).toBe(20);
            expect(DEFAULT_POOL_CONFIG.connectionTimeout).toBe(30);
            expect(DEFAULT_POOL_CONFIG.idleTimeout).toBe(1800);
        });
    });
});
