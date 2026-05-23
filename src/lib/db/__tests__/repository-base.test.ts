/**
 * Tests for repository-base.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original process.env
const originalEnv = { ...process.env };

describe('repository-base', () => {
    beforeEach(() => {
        vi.resetModules();
        // Restore env vars
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
        process.env.SUPABASE_SECRET_KEY = 'test-secret-key';
    });

    afterEach(() => {
        // Restore original env
        process.env = { ...originalEnv };
    });

    describe('Constants', () => {
        it('should have correct DEFAULT_LIMIT', async () => {
            const { DEFAULT_LIMIT } = await import('../repository-base');
            expect(DEFAULT_LIMIT).toBe(50);
        });

        it('should have correct MAX_LIMIT', async () => {
            const { MAX_LIMIT } = await import('../repository-base');
            expect(MAX_LIMIT).toBe(200);
        });
    });

    describe('resetRepositoryClient', () => {
        it('should be safe to call multiple times', async () => {
            const { resetRepositoryClient } = await import('../repository-base');

            resetRepositoryClient();
            resetRepositoryClient();
            resetRepositoryClient();

            // Should not throw
            expect(true).toBe(true);
        });

        it('should be safe to call when no client exists', async () => {
            const { resetRepositoryClient } = await import('../repository-base');

            // Call reset without creating a client first
            resetRepositoryClient();

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe('normalizePagination', () => {
        it('should return default values when no params provided', async () => {
            const { normalizePagination, DEFAULT_LIMIT } = await import('../repository-base');

            const result = normalizePagination();

            expect(result.limit).toBe(DEFAULT_LIMIT);
            expect(result.offset).toBe(0);
        });

        it('should return default values when undefined params provided', async () => {
            const { normalizePagination, DEFAULT_LIMIT } = await import('../repository-base');

            const result = normalizePagination(undefined);

            expect(result.limit).toBe(DEFAULT_LIMIT);
            expect(result.offset).toBe(0);
        });

        it('should use provided limit when within bounds', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ limit: 25 });

            expect(result.limit).toBe(25);
        });

        it('should use provided offset', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ offset: 100 });

            expect(result.offset).toBe(100);
        });

        it('should cap limit at MAX_LIMIT', async () => {
            const { normalizePagination, MAX_LIMIT } = await import('../repository-base');

            const result = normalizePagination({ limit: 500 });

            expect(result.limit).toBe(MAX_LIMIT);
        });

        it('should cap limit exactly at MAX_LIMIT', async () => {
            const { normalizePagination, MAX_LIMIT } = await import('../repository-base');

            const result = normalizePagination({ limit: MAX_LIMIT });

            expect(result.limit).toBe(MAX_LIMIT);
        });

        it('should allow limit just below MAX_LIMIT', async () => {
            const { normalizePagination, MAX_LIMIT } = await import('../repository-base');

            const result = normalizePagination({ limit: MAX_LIMIT - 1 });

            expect(result.limit).toBe(MAX_LIMIT - 1);
        });

        it('should handle limit of 0', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ limit: 0 });

            expect(result.limit).toBe(0);
        });

        it('should handle offset of 0', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ offset: 0 });

            expect(result.offset).toBe(0);
        });

        it('should handle both limit and offset provided', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ limit: 75, offset: 150 });

            expect(result.limit).toBe(75);
            expect(result.offset).toBe(150);
        });

        it('should cap limit while preserving offset', async () => {
            const { normalizePagination, MAX_LIMIT } = await import('../repository-base');

            const result = normalizePagination({ limit: 1000, offset: 50 });

            expect(result.limit).toBe(MAX_LIMIT);
            expect(result.offset).toBe(50);
        });

        it('should return Required<PaginationParams> type', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ limit: 10, offset: 5 });

            // TypeScript should infer these as numbers, not number | undefined
            const limit: number = result.limit;
            const offset: number = result.offset;

            expect(typeof limit).toBe('number');
            expect(typeof offset).toBe('number');
        });
    });

    describe('PaginationParams interface', () => {
        it('should accept empty object', async () => {
            const { normalizePagination, DEFAULT_LIMIT } = await import('../repository-base');

            const result = normalizePagination({});

            expect(result.limit).toBe(DEFAULT_LIMIT);
            expect(result.offset).toBe(0);
        });

        it('should accept partial params', async () => {
            const { normalizePagination, DEFAULT_LIMIT } = await import('../repository-base');

            const result1 = normalizePagination({ limit: 10 });
            const result2 = normalizePagination({ offset: 20 });

            expect(result1.limit).toBe(10);
            expect(result1.offset).toBe(0);
            expect(result2.limit).toBe(DEFAULT_LIMIT);
            expect(result2.offset).toBe(20);
        });
    });

    describe('Edge cases', () => {
        it('should handle very large offset values', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ offset: Number.MAX_SAFE_INTEGER });

            expect(result.offset).toBe(Number.MAX_SAFE_INTEGER);
        });

        it('should handle negative limit (not prevented)', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ limit: -10 });

            // Math.min(-10, 200) = -10
            expect(result.limit).toBe(-10);
        });

        it('should handle negative offset (not prevented)', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ offset: -50 });

            expect(result.offset).toBe(-50);
        });

        it('should handle decimal limit', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ limit: 10.5 });

            expect(result.limit).toBe(10.5);
        });

        it('should handle decimal offset', async () => {
            const { normalizePagination } = await import('../repository-base');

            const result = normalizePagination({ offset: 10.5 });

            expect(result.offset).toBe(10.5);
        });
    });
});
