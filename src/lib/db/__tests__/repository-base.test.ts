/**
 * Tests for repository-base.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock environment variables before any imports
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SECRET_KEY', 'test-secret-key');

// Mock the Supabase client
const mockCreateClient = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import {
    getRepositoryClient,
    resetRepositoryClient,
    normalizePagination,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    type PaginationParams,
} from '../repository-base';

describe('repository-base', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        resetRepositoryClient();
    });

    afterEach(() => {
        process.env = originalEnv;
        resetRepositoryClient();
    });

    describe('Constants', () => {
        it('should have correct DEFAULT_LIMIT', () => {
            expect(DEFAULT_LIMIT).toBe(50);
        });

        it('should have correct MAX_LIMIT', () => {
            expect(MAX_LIMIT).toBe(200);
        });
    });

    describe('getRepositoryClient', () => {
        it('should create a Supabase client with correct config', () => {
            const mockClient = { from: vi.fn() };
            mockCreateClient.mockReturnValueOnce(mockClient);

            const client = getRepositoryClient();

            expect(mockCreateClient).toHaveBeenCalledWith(
                'https://test.supabase.co',
                'test-secret-key'
            );
            expect(client).toBe(mockClient);
        });

        it('should return the same client on subsequent calls (singleton)', () => {
            const mockClient = { from: vi.fn() };
            mockCreateClient.mockReturnValueOnce(mockClient);

            const client1 = getRepositoryClient();
            const client2 = getRepositoryClient();

            expect(client1).toBe(client2);
            expect(mockCreateClient).toHaveBeenCalledTimes(1);
        });

        it('should throw when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
            const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;

            expect(() => getRepositoryClient()).toThrow('Supabase configuration missing');

            process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        });

        it('should throw when SUPABASE_SECRET_KEY is missing', () => {
            const originalKey = process.env.SUPABASE_SECRET_KEY;
            delete process.env.SUPABASE_SECRET_KEY;

            expect(() => getRepositoryClient()).toThrow('Supabase configuration missing');

            process.env.SUPABASE_SECRET_KEY = originalKey;
        });

        it('should indicate which config is missing in error message', () => {
            const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const originalKey = process.env.SUPABASE_SECRET_KEY;
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.SUPABASE_SECRET_KEY;

            try {
                getRepositoryClient();
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                const message = (error as Error).message;
                expect(message).toContain('NEXT_PUBLIC_SUPABASE_URL: false');
                expect(message).toContain('SUPABASE_SECRET_KEY: false');
            }

            process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
            process.env.SUPABASE_SECRET_KEY = originalKey;
        });

        it('should create new client after reset', () => {
            const mockClient1 = { from: vi.fn(), id: 1 };
            const mockClient2 = { from: vi.fn(), id: 2 };

            mockCreateClient.mockReturnValueOnce(mockClient1);
            mockCreateClient.mockReturnValueOnce(mockClient2);

            const client1 = getRepositoryClient();
            resetRepositoryClient();
            const client2 = getRepositoryClient();

            expect(client1).not.toBe(client2);
            expect(mockCreateClient).toHaveBeenCalledTimes(2);
        });
    });

    describe('resetRepositoryClient', () => {
        it('should reset the singleton client', () => {
            const mockClient = { from: vi.fn() };
            mockCreateClient.mockReturnValueOnce(mockClient);

            // Create initial client
            getRepositoryClient();
            expect(mockCreateClient).toHaveBeenCalledTimes(1);

            // Reset and create new client
            resetRepositoryClient();
            mockCreateClient.mockReturnValueOnce(mockClient);
            getRepositoryClient();
            expect(mockCreateClient).toHaveBeenCalledTimes(2);
        });

        it('should be safe to call multiple times', () => {
            resetRepositoryClient();
            resetRepositoryClient();
            resetRepositoryClient();

            // Should not throw
            expect(true).toBe(true);
        });

        it('should be safe to call when no client exists', () => {
            // Call reset without creating a client first
            resetRepositoryClient();

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe('normalizePagination', () => {
        it('should return default values when no params provided', () => {
            const result = normalizePagination();

            expect(result.limit).toBe(DEFAULT_LIMIT);
            expect(result.offset).toBe(0);
        });

        it('should return default values when undefined params provided', () => {
            const result = normalizePagination(undefined);

            expect(result.limit).toBe(DEFAULT_LIMIT);
            expect(result.offset).toBe(0);
        });

        it('should use provided limit when within bounds', () => {
            const params: PaginationParams = { limit: 25 };
            const result = normalizePagination(params);

            expect(result.limit).toBe(25);
        });

        it('should use provided offset', () => {
            const params: PaginationParams = { offset: 100 };
            const result = normalizePagination(params);

            expect(result.offset).toBe(100);
        });

        it('should cap limit at MAX_LIMIT', () => {
            const params: PaginationParams = { limit: 500 };
            const result = normalizePagination(params);

            expect(result.limit).toBe(MAX_LIMIT);
        });

        it('should cap limit exactly at MAX_LIMIT', () => {
            const params: PaginationParams = { limit: MAX_LIMIT };
            const result = normalizePagination(params);

            expect(result.limit).toBe(MAX_LIMIT);
        });

        it('should allow limit just below MAX_LIMIT', () => {
            const params: PaginationParams = { limit: MAX_LIMIT - 1 };
            const result = normalizePagination(params);

            expect(result.limit).toBe(MAX_LIMIT - 1);
        });

        it('should handle limit of 0', () => {
            const params: PaginationParams = { limit: 0 };
            const result = normalizePagination(params);

            expect(result.limit).toBe(0);
        });

        it('should handle offset of 0', () => {
            const params: PaginationParams = { offset: 0 };
            const result = normalizePagination(params);

            expect(result.offset).toBe(0);
        });

        it('should handle both limit and offset provided', () => {
            const params: PaginationParams = { limit: 75, offset: 150 };
            const result = normalizePagination(params);

            expect(result.limit).toBe(75);
            expect(result.offset).toBe(150);
        });

        it('should cap limit while preserving offset', () => {
            const params: PaginationParams = { limit: 1000, offset: 50 };
            const result = normalizePagination(params);

            expect(result.limit).toBe(MAX_LIMIT);
            expect(result.offset).toBe(50);
        });

        it('should return Required<PaginationParams> type', () => {
            const result = normalizePagination({ limit: 10, offset: 5 });

            // TypeScript should infer these as numbers, not number | undefined
            const limit: number = result.limit;
            const offset: number = result.offset;

            expect(typeof limit).toBe('number');
            expect(typeof offset).toBe('number');
        });
    });

    describe('PaginationParams interface', () => {
        it('should accept empty object', () => {
            const params: PaginationParams = {};
            const result = normalizePagination(params);

            expect(result.limit).toBe(DEFAULT_LIMIT);
            expect(result.offset).toBe(0);
        });

        it('should accept partial params', () => {
            const params1: PaginationParams = { limit: 10 };
            const params2: PaginationParams = { offset: 20 };

            expect(normalizePagination(params1).limit).toBe(10);
            expect(normalizePagination(params1).offset).toBe(0);
            expect(normalizePagination(params2).limit).toBe(DEFAULT_LIMIT);
            expect(normalizePagination(params2).offset).toBe(20);
        });
    });

    describe('Edge cases', () => {
        it('should handle very large offset values', () => {
            const params: PaginationParams = { offset: Number.MAX_SAFE_INTEGER };
            const result = normalizePagination(params);

            expect(result.offset).toBe(Number.MAX_SAFE_INTEGER);
        });

        it('should handle negative limit (not prevented)', () => {
            const params: PaginationParams = { limit: -10 };
            const result = normalizePagination(params);

            // Math.min(-10, 200) = -10
            expect(result.limit).toBe(-10);
        });

        it('should handle negative offset (not prevented)', () => {
            const params: PaginationParams = { offset: -50 };
            const result = normalizePagination(params);

            expect(result.offset).toBe(-50);
        });

        it('should handle decimal limit', () => {
            const params: PaginationParams = { limit: 10.5 };
            const result = normalizePagination(params);

            expect(result.limit).toBe(10.5);
        });

        it('should handle decimal offset', () => {
            const params: PaginationParams = { offset: 10.5 };
            const result = normalizePagination(params);

            expect(result.offset).toBe(10.5);
        });
    });
});
