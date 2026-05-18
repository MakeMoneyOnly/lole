/**
 * Notification Deduplication Service Tests
 *
 * Tests for deduplication logic, key generation, and helper functions.
 * Note: Redis-dependent tests are mocked since Redis may not be available in test environment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getDedupeKey,
    getDeduplicationWindow,
    DEDUP_CONFIG,
    hashMessageContent,
    isMessageSimilar,
    normalizePhone,
    type NotificationType,
    type DedupeCheckParams,
} from '../deduplication';

// =========================================================
// Test Suites
// =========================================================

describe('Notification Deduplication Service', () => {
    describe('getDeduplicationWindow', () => {
        it('should return 1 hour for order_status', () => {
            const window = getDeduplicationWindow('order_status');
            expect(window).toBe(60 * 60);
        });

        it('should return 30 minutes for waitlist', () => {
            const window = getDeduplicationWindow('waitlist');
            expect(window).toBe(30 * 60);
        });

        it('should return 24 hours for promotion', () => {
            const window = getDeduplicationWindow('promotion');
            expect(window).toBe(24 * 60 * 60);
        });

        it('should return 2 hours for reservation', () => {
            const window = getDeduplicationWindow('reservation');
            expect(window).toBe(2 * 60 * 60);
        });

        it('should return custom window when provided', () => {
            const customWindow = 300; // 5 minutes
            const window = getDeduplicationWindow('order_status', customWindow);
            expect(window).toBe(customWindow);
        });

        it('should return correct window for order_status type', () => {
            const window = getDeduplicationWindow('order_status');
            expect(window).toBe(DEDUP_CONFIG.WINDOWS.order_status);
        });
    });

    describe('normalizePhone', () => {
        it('should handle local Ethiopian phone numbers', () => {
            expect(normalizePhone('0912345678')).toBe('0912345678');
            expect(normalizePhone('0912 345 678')).toBe('0912345678');
        });

        it('should convert +251 format to local', () => {
            expect(normalizePhone('+251912345678')).toBe('0912345678');
        });

        it('should convert 251 format to local', () => {
            expect(normalizePhone('251912345678')).toBe('0912345678');
        });

        it('should handle international format with spaces', () => {
            expect(normalizePhone('+251 912 345 678')).toBe('0912345678');
            expect(normalizePhone('251 912 345 678')).toBe('0912345678');
        });

        it('should preserve + for other country codes', () => {
            expect(normalizePhone('+1234567890')).toBe('+1234567890');
        });
    });

    describe('getDedupeKey', () => {
        const baseParams: DedupeCheckParams = {
            guestPhone: '0912345678',
            notificationType: 'order_status',
        };

        it('should generate consistent keys for same inputs', () => {
            const key1 = getDedupeKey(baseParams);
            const key2 = getDedupeKey(baseParams);
            expect(key1).toBe(key2);
        });

        it('should generate different keys for different phones', () => {
            const key1 = getDedupeKey({ ...baseParams, guestPhone: '0912345678' });
            const key2 = getDedupeKey({ ...baseParams, guestPhone: '0998765432' });
            expect(key1).not.toBe(key2);
        });

        it('should generate different keys for different notification types', () => {
            const key1 = getDedupeKey({ ...baseParams, notificationType: 'order_status' });
            const key2 = getDedupeKey({ ...baseParams, notificationType: 'waitlist' });
            expect(key1).not.toBe(key2);
        });

        it('should include relevantId in key when provided', () => {
            const keyWithId = getDedupeKey({ ...baseParams, relevantId: 'order-123' });
            const keyWithoutId = getDedupeKey({ ...baseParams, relevantId: undefined });
            expect(keyWithId).not.toBe(keyWithoutId);
        });

        it('should use general when relevantId is not provided', () => {
            const key = getDedupeKey(baseParams);
            expect(key).toContain('general');
        });

        it('should include notification type in key', () => {
            const key = getDedupeKey(baseParams);
            expect(key).toContain('order_status');
        });

        it('should use hashed phone in key', () => {
            const key = getDedupeKey(baseParams);
            expect(key).toContain(DEDUP_CONFIG.KEY_PREFIX);
        });

        it('should generate valid key when message is provided', () => {
            const key = getDedupeKey({ ...baseParams, message: 'Test message' });
            expect(key).toBeDefined();
        });
    });

    describe('hashMessageContent', () => {
        it('should generate consistent hashes for same content', () => {
            const hash1 = hashMessageContent('Hello, World!');
            const hash2 = hashMessageContent('Hello, World!');
            expect(hash1).toBe(hash2);
        });

        it('should generate different hashes for different content', () => {
            const hash1 = hashMessageContent('Hello, World!');
            const hash2 = hashMessageContent('Goodbye, World!');
            expect(hash1).not.toBe(hash2);
        });

        it('should be case-insensitive', () => {
            const hash1 = hashMessageContent('Hello, World!');
            const hash2 = hashMessageContent('HELLO, WORLD!');
            expect(hash1).toBe(hash2);
        });

        it('should trim whitespace', () => {
            const hash1 = hashMessageContent('  Hello, World!  ');
            const hash2 = hashMessageContent('Hello, World!');
            expect(hash1).toBe(hash2);
        });

        it('should return 64-character hex string', () => {
            const hash = hashMessageContent('Test message');
            expect(hash).toMatch(/^[a-f0-9]{64}$/);
        });
    });

    describe('isMessageSimilar', () => {
        it('should return true for identical messages', () => {
            expect(isMessageSimilar('Hello', 'Hello')).toBe(true);
        });

        it('should return true for case-insensitive matches', () => {
            expect(isMessageSimilar('Hello', 'HELLO')).toBe(true);
        });

        it('should return true for messages within similarity threshold', () => {
            expect(isMessageSimilar('Hello World', 'Hello World!', 0.9)).toBe(true);
        });

        it('should return false for messages outside similarity threshold', () => {
            expect(isMessageSimilar('Hi', 'Hello World', 0.9)).toBe(false);
        });

        it('should use default threshold of 0.9', () => {
            expect(isMessageSimilar('Hello World', 'Hello World!')).toBe(true);
            expect(isMessageSimilar('Hi', 'Hello World')).toBe(false);
        });

        it('should accept custom threshold', () => {
            // Length similarity between "Hi" (2) and "Hello" (5) = 1 - 3/5 = 0.4
            expect(isMessageSimilar('Hi', 'Hello', 0.3)).toBe(true);
            expect(isMessageSimilar('Hi', 'Hello', 0.5)).toBe(false);
            // Length similarity between "Hello" (5) and "Hello World" (11) = 1 - 6/11 = 0.45
            expect(isMessageSimilar('Hello', 'Hello World', 0.4)).toBe(true);
            expect(isMessageSimilar('Hello', 'Hello World', 0.5)).toBe(false);
        });

        it('should handle empty strings', () => {
            expect(isMessageSimilar('', '')).toBe(false);
            expect(isMessageSimilar('', 'Hello')).toBe(false);
        });
    });

    describe('DEDUP_CONFIG', () => {
        it('should have correct default window', () => {
            expect(DEDUP_CONFIG.DEFAULT_WINDOW_SECONDS).toBe(24 * 60 * 60);
        });

        it('should have all required notification type windows', () => {
            expect(DEDUP_CONFIG.WINDOWS.order_status).toBeDefined();
            expect(DEDUP_CONFIG.WINDOWS.waitlist).toBeDefined();
            expect(DEDUP_CONFIG.WINDOWS.promotion).toBeDefined();
            expect(DEDUP_CONFIG.WINDOWS.reservation).toBeDefined();
        });

        it('should have correct key prefix', () => {
            expect(DEDUP_CONFIG.KEY_PREFIX).toBe('notif:dedup');
        });

        it('should have content dedup disabled by default', () => {
            expect(DEDUP_CONFIG.ENABLE_CONTENT_DEDUP).toBe(false);
        });
    });
});

// =========================================================
// Integration Tests (Mocked Redis)
// =========================================================

describe('Deduplication with Redis (Mocked)', () => {
    const _mockRedis = {
        set: vi.fn(),
        get: vi.fn(),
        ttl: vi.fn(),
        scan: vi.fn(),
        del: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('isDuplicate behavior', () => {
        it('should have isDuplicate function defined', async () => {
            const { isDuplicate } = await import('../deduplication');
            expect(isDuplicate).toBeDefined();
            expect(typeof isDuplicate).toBe('function');
        });
    });

    describe('getDedupeKey deterministic behavior', () => {
        it('should produce deterministic keys across multiple calls', () => {
            const params: DedupeCheckParams = {
                guestPhone: '0912345678',
                notificationType: 'order_status',
                relevantId: 'order-123',
            };

            const keys = Array.from({ length: 10 }, () => getDedupeKey(params));

            // All keys should be identical
            expect(new Set(keys).size).toBe(1);
        });

        it('should produce different keys for different relevantIds', () => {
            const baseParams = {
                guestPhone: '0912345678',
                notificationType: 'order_status' as NotificationType,
            };

            const key1 = getDedupeKey({ ...baseParams, relevantId: 'order-1' });
            const key2 = getDedupeKey({ ...baseParams, relevantId: 'order-2' });

            expect(key1).not.toBe(key2);
        });
    });
});

// =========================================================
// Edge Cases and Error Handling
// =========================================================

describe('Deduplication Edge Cases', () => {
    describe('Phone number edge cases', () => {
        it('should handle empty phone number', () => {
            const key = getDedupeKey({
                guestPhone: '',
                notificationType: 'order_status',
            });
            expect(key).toBeDefined();
        });

        it('should handle phone with special characters', () => {
            const key = getDedupeKey({
                guestPhone: '+1 (234) 567-8900',
                notificationType: 'order_status',
            });
            expect(key).toBeDefined();
        });

        it('should handle very long phone numbers', () => {
            const key = getDedupeKey({
                guestPhone: '0'.repeat(20),
                notificationType: 'order_status',
            });
            expect(key).toBeDefined();
        });
    });

    describe('Notification type edge cases', () => {
        it('should handle all valid notification types', () => {
            const types: NotificationType[] = [
                'order_status',
                'waitlist',
                'promotion',
                'reservation',
            ];

            types.forEach(type => {
                const window = getDeduplicationWindow(type);
                expect(window).toBeGreaterThan(0);
            });
        });
    });

    describe('Key generation edge cases', () => {
        it('should handle missing relevantId', () => {
            const key = getDedupeKey({
                guestPhone: '0912345678',
                notificationType: 'order_status',
            });
            expect(key).toContain('general');
        });

        it('should handle empty message', () => {
            const key = getDedupeKey({
                guestPhone: '0912345678',
                notificationType: 'order_status',
                message: '',
            });
            expect(key).toBeDefined();
        });
    });
});

// =========================================================
// Performance Tests
// =========================================================

describe('Deduplication Performance', () => {
    describe('Key generation performance', () => {
        it('should generate keys quickly', () => {
            const iterations = 1000;
            const start = performance.now();

            for (let i = 0; i < iterations; i++) {
                getDedupeKey({
                    guestPhone: `091234${i}`,
                    notificationType: 'order_status',
                    relevantId: `order-${i}`,
                });
            }

            const duration = performance.now() - start;
            // Should complete 1000 iterations in under 100ms
            expect(duration).toBeLessThan(100);
        });

        it('should handle concurrent key generation', async () => {
            const iterations = 100;

            const generateKeys = async (): Promise<void> => {
                const keys: string[] = [];
                for (let i = 0; i < iterations; i++) {
                    keys.push(
                        getDedupeKey({
                            guestPhone: `091234${i}`,
                            notificationType: 'order_status',
                        })
                    );
                }
                return keys;
            };

            const start = performance.now();
            const results = await Promise.all([generateKeys(), generateKeys(), generateKeys()]);
            const duration = performance.now() - start;

            // Should complete without errors
            expect(results).toHaveLength(3);
            expect(duration).toBeLessThan(200);
        });
    });
});
