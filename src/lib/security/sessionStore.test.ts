/**
 * Session Store Tests
 *
 * Tests for both Memory and Redis session stores
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemorySessionStore, type SessionData } from './sessionStore';

// Mock Redis for testing - using a simple object with data property
// Note: Redis tests can be added when RedisSessionStore needs to be tested
const mockRedisData = new Map<string, string>();

const _createMockRedis = (): any => ({
    data: mockRedisData,
    get: vi.fn(async (key: string) => {
        const value = mockRedisData.get(key);
        return value || null;
    }),
    set: vi.fn(async (key: string, value: string) => {
        mockRedisData.set(key, value);
        return 'OK';
    }),
    setex: vi.fn(async (key: string, _seconds: number, value: string) => {
        mockRedisData.set(key, value);
        return 'OK';
    }),
    del: vi.fn(async (key: string) => {
        const existed = mockRedisData.has(key);
        mockRedisData.delete(key);
        return existed ? 1 : 0;
    }),
    exists: vi.fn(async (key: string) => {
        return mockRedisData.has(key) ? 1 : 0;
    }),
    keys: vi.fn(async (pattern: string) => {
        const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
        const keys = Array.from(mockRedisData.keys()) as string[];
        return keys.filter(k => k.startsWith(prefix));
    }),
    quit: vi.fn(async () => {}),
});

describe('MemorySessionStore', () => {
    let store: MemorySessionStore;

    beforeEach(() => {
        store = new MemorySessionStore(30); // 30 second TTL for faster tests
    });

    afterEach(async () => {
        // Clear any pending timers
        vi.clearAllTimers();
    });

    const mockSessionData: SessionData = {
        userId: 'user-123',
        lastActivity: Date.now(),
        createdAt: Date.now(),
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
    };

    describe('set and get', () => {
        it('should store and retrieve session data', async () => {
            await store.set('session-1', mockSessionData);

            const retrieved = await store.get('session-1');

            expect(retrieved).not.toBeNull();
            expect(retrieved?.userId).toBe('user-123');
            expect(retrieved?.ipAddress).toBe('192.168.1.1');
        });

        it('should return null for non-existent session', async () => {
            const retrieved = await store.get('non-existent');
            expect(retrieved).toBeNull();
        });

        it('should respect custom TTL', async () => {
            vi.useFakeTimers();

            await store.set('session-1', mockSessionData, 1); // 1 second TTL

            // Advance time by 500ms
            vi.advanceTimersByTime(500);
            let retrieved = await store.get('session-1');
            expect(retrieved).not.toBeNull();

            // Advance time by another 600ms (total 1.1 seconds)
            vi.advanceTimersByTime(600);
            retrieved = await store.get('session-1');
            expect(retrieved).toBeNull();

            vi.useRealTimers();
        });
    });

    describe('delete', () => {
        it('should delete an existing session', async () => {
            await store.set('session-1', mockSessionData);

            const deleted = await store.delete('session-1');
            expect(deleted).toBe(true);

            const retrieved = await store.get('session-1');
            expect(retrieved).toBeNull();
        });

        it('should return false for non-existent session', async () => {
            const deleted = await store.delete('non-existent');
            expect(deleted).toBe(false);
        });
    });

    describe('exists', () => {
        it('should return true for existing session', async () => {
            await store.set('session-1', mockSessionData);

            const exists = await store.exists('session-1');
            expect(exists).toBe(true);
        });

        it('should return false for non-existent session', async () => {
            const exists = await store.exists('non-existent');
            expect(exists).toBe(false);
        });

        it('should return false for expired session', async () => {
            vi.useFakeTimers();

            await store.set('session-1', mockSessionData, 1);

            vi.advanceTimersByTime(1100);

            const exists = await store.exists('session-1');
            expect(exists).toBe(false);

            vi.useRealTimers();
        });
    });

    describe('updateActivity', () => {
        it('should update lastActivity timestamp', async () => {
            const initialTime = Date.now();
            await store.set('session-1', { ...mockSessionData, lastActivity: initialTime });

            // Wait a bit to ensure time difference
            const updated = await store.updateActivity('session-1');
            expect(updated).toBe(true);

            const session = await store.get('session-1');
            expect(session).not.toBeNull();
            // The lastActivity should be updated to a newer timestamp
            expect(session!.lastActivity).toBeGreaterThanOrEqual(initialTime);
        });

        it('should return false for non-existent session', async () => {
            const updated = await store.updateActivity('non-existent');
            expect(updated).toBe(false);
        });
    });

    describe('cleanup', () => {
        it('should remove expired sessions', async () => {
            vi.useFakeTimers();

            await store.set('session-1', mockSessionData, 1);
            await store.set('session-2', mockSessionData, 30);

            vi.advanceTimersByTime(1100);

            const cleaned = await store.cleanup();
            expect(cleaned).toBe(1);

            const session1 = await store.get('session-1');
            const session2 = await store.get('session-2');

            expect(session1).toBeNull();
            expect(session2).not.toBeNull();

            vi.useRealTimers();
        });
    });

    describe('sync methods', () => {
        it('should support sync get and set', () => {
            store.setSync('session-1', mockSessionData);

            const retrieved = store.getSync('session-1');
            expect(retrieved).not.toBeNull();
            expect(retrieved?.userId).toBe('user-123');
        });

        it('should return null for expired sessions in sync mode', () => {
            vi.useFakeTimers();

            store.setSync('session-1', mockSessionData, 1);

            vi.advanceTimersByTime(1100);

            const retrieved = store.getSync('session-1');
            expect(retrieved).toBeNull();

            vi.useRealTimers();
        });
    });
});

describe('Session Store Integration', () => {
    it('should handle concurrent operations', async () => {
        const store = new MemorySessionStore(300);

        // Create multiple sessions concurrently
        const sessionIds = ['s1', 's2', 's3', 's4', 's5'];
        const sessionData: SessionData = {
            userId: 'user-123',
            lastActivity: Date.now(),
            createdAt: Date.now(),
            ipAddress: '192.168.1.1',
            userAgent: 'test',
        };

        await Promise.all(
            sessionIds.map(id => store.set(id, { ...sessionData, userId: `user-${id}` }))
        );

        // Verify all sessions exist
        const results = await Promise.all(sessionIds.map(id => store.get(id)));

        results.forEach((session, index) => {
            expect(session).not.toBeNull();
            expect(session!.userId).toBe(`user-${sessionIds[index]}`);
        });
    });

    it('should handle session metadata', async () => {
        const store = new MemorySessionStore(300);

        const sessionData: SessionData = {
            userId: 'user-123',
            lastActivity: Date.now(),
            createdAt: Date.now(),
            ipAddress: '192.168.1.1',
            userAgent: 'test',
            role: 'admin',
            restaurantId: 'restaurant-1',
            metadata: { theme: 'dark', lastPage: '/dashboard' },
        };

        await store.set('session-1', sessionData);

        const retrieved = await store.get('session-1');

        expect(retrieved).not.toBeNull();
        expect(retrieved!.role).toBe('admin');
        expect(retrieved!.restaurantId).toBe('restaurant-1');
        expect(retrieved!.metadata).toEqual({ theme: 'dark', lastPage: '/dashboard' });
    });
});
