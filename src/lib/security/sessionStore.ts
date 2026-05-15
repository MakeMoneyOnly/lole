/**
 * Session Store - Redis-backed with Memory Fallback
 *
 * Production-ready session storage that uses Redis when available,
 * with automatic fallback to memory store for development.
 *
 * Addresses COMPREHENSIVE_CODEBASE_AUDIT_REPORT Section 3.1
 */

import { env, hasRedis } from '@/lib/config/env';
import { logger } from '@/lib/logger';

const log = logger.child('[session-store]');

/**
 * Session data structure
 */
export interface SessionData {
    userId: string;
    lastActivity: number;
    createdAt: number;
    ipAddress: string;
    userAgent: string;
    role?: string;
    restaurantId?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Session store interface - allows for different backends
 */
export interface SessionStore {
    get(sessionId: string): Promise<SessionData | null>;
    set(sessionId: string, data: SessionData, ttl?: number): Promise<void>;
    delete(sessionId: string): Promise<boolean>;
    exists(sessionId: string): Promise<boolean>;
    updateActivity(sessionId: string): Promise<boolean>;
    getAllSessionIds?(): Promise<string[]>;
    cleanup?(): Promise<number>;
}

/**
 * In-memory session store (for development/fallback)
 */
export class MemorySessionStore implements SessionStore {
    private sessions = new Map<string, { data: SessionData; expiresAt: number }>();
    private readonly defaultTTL: number;

    constructor(defaultTTL: number = 30 * 60) {
        this.defaultTTL = defaultTTL;
        // Start cleanup interval
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    async get(sessionId: string): Promise<SessionData | null> {
        const entry = this.sessions.get(sessionId);
        if (!entry) return null;

        if (Date.now() > entry.expiresAt) {
            this.sessions.delete(sessionId);
            return null;
        }

        return entry.data;
    }

    async set(sessionId: string, data: SessionData, ttl?: number): Promise<void> {
        const expiresAt = Date.now() + (ttl || this.defaultTTL) * 1000;
        this.sessions.set(sessionId, { data, expiresAt });
    }

    async delete(sessionId: string): Promise<boolean> {
        return this.sessions.delete(sessionId);
    }

    async exists(sessionId: string): Promise<boolean> {
        const entry = this.sessions.get(sessionId);
        if (!entry) return false;

        if (Date.now() > entry.expiresAt) {
            this.sessions.delete(sessionId);
            return false;
        }

        return true;
    }

    async updateActivity(sessionId: string): Promise<boolean> {
        const entry = this.sessions.get(sessionId);
        if (!entry) return false;

        entry.data.lastActivity = Date.now();
        entry.expiresAt = Date.now() + this.defaultTTL * 1000;
        return true;
    }

    async getAllSessionIds(): Promise<string[]> {
        return Array.from(this.sessions.keys());
    }

    async cleanup(): Promise<number> {
        const now = Date.now();
        let cleaned = 0;

        for (const [sessionId, entry] of this.sessions.entries()) {
            if (now > entry.expiresAt) {
                this.sessions.delete(sessionId);
                cleaned++;
            }
        }

        return cleaned;
    }

    // Sync methods for backward compatibility
    getSync(sessionId: string): SessionData | null {
        const entry = this.sessions.get(sessionId);
        if (!entry || Date.now() > entry.expiresAt) {
            return null;
        }
        return entry.data;
    }

    setSync(sessionId: string, data: SessionData, ttl?: number): void {
        const expiresAt = Date.now() + (ttl || this.defaultTTL) * 1000;
        this.sessions.set(sessionId, { data, expiresAt });
    }
}

/**
 * Redis session store (for production)
 */
export class RedisSessionStore implements SessionStore {
    private client: RedisClient;
    private readonly keyPrefix: string;
    private readonly defaultTTL: number;

    constructor(client: RedisClient, keyPrefix: string = 'session:', defaultTTL: number = 30 * 60) {
        this.client = client;
        this.keyPrefix = keyPrefix;
        this.defaultTTL = defaultTTL;
    }

    private getKey(sessionId: string): string {
        return `${this.keyPrefix}${sessionId}`;
    }

    async get(sessionId: string): Promise<SessionData | null> {
        const key = this.getKey(sessionId);
        const data = await this.client.get(key);

        if (!data) return null;

        try {
            return JSON.parse(data) as SessionData;
        } catch {
            await this.client.del(key);
            return null;
        }
    }

    async set(sessionId: string, data: SessionData, ttl?: number): Promise<void> {
        const key = this.getKey(sessionId);
        const value = JSON.stringify(data);
        const expiresInSeconds = ttl || this.defaultTTL;

        await this.client.setex(key, expiresInSeconds, value);
    }

    async delete(sessionId: string): Promise<boolean> {
        const key = this.getKey(sessionId);
        const result = await this.client.del(key);
        return result > 0;
    }

    async exists(sessionId: string): Promise<boolean> {
        const key = this.getKey(sessionId);
        const result = await this.client.exists(key);
        return result === 1;
    }

    async updateActivity(sessionId: string): Promise<boolean> {
        const data = await this.get(sessionId);

        if (!data) return false;

        data.lastActivity = Date.now();
        await this.set(sessionId, data, this.defaultTTL);
        return true;
    }

    async getAllSessionIds(): Promise<string[]> {
        const pattern = `${this.keyPrefix}*`;
        const keys = await this.client.keys(pattern);
        return keys.map(key => key.replace(this.keyPrefix, ''));
    }

    async cleanup(): Promise<number> {
        // Redis handles TTL automatically, but we can clean up expired sessions
        // that might have been set without TTL
        let cleaned = 0;
        const keys = await this.getAllSessionIds();

        for (const sessionId of keys) {
            const data = await this.get(sessionId);
            if (data) {
                const maxLifetime = 8 * 60 * 60 * 1000; // 8 hours
                if (Date.now() - data.createdAt > maxLifetime) {
                    await this.delete(sessionId);
                    cleaned++;
                }
            }
        }

        return cleaned;
    }
}

/**
 * Redis client interface (minimal)
 */
export interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<'OK' | null>;
    setex(key: string, seconds: number, value: string): Promise<'OK' | null>;
    del(key: string): Promise<number>;
    exists(key: string): Promise<number>;
    keys(pattern: string): Promise<string[]>;
    quit(): Promise<void>;
}

/**
 * Create Redis client
 */
async function createRedisClient(): Promise<RedisClient | null> {
    const redisUrl = env.REDIS_URL;

    if (!redisUrl) {
        return null;
    }

    try {
        // Dynamic import to avoid bundling issues if Redis isn't needed
        const { Redis } = await import('ioredis');
        const redis = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
            retryStrategy: (times: number) => {
                if (times > 3) {
                    log.warn('Redis connection retry limit reached');
                    return null;
                }
                return Math.min(times * 100, 3000);
            },
        });

        // Test connection
        await redis.ping();

        log.info('Redis connected for session storage');
        return redis as unknown as RedisClient;
    } catch (error) {
        log.warn('Redis connection failed, falling back to memory store', { error });
        return null;
    }
}

// Singleton stores
let memoryStore: MemorySessionStore | null = null;
let redisStore: RedisSessionStore | null = null;
let redisClient: RedisClient | null = null;
let initializationPromise: Promise<void> | null = null;

/**
 * Initialize session store
 * Should be called at application startup
 */
export async function initializeSessionStore(): Promise<void> {
    if (initializationPromise) {
        return initializationPromise;
    }

    initializationPromise = (async () => {
        if (hasRedis()) {
            redisClient = await createRedisClient();

            if (redisClient) {
                redisStore = new RedisSessionStore(redisClient);
                return;
            }
        }

// Fall back to memory store
         memoryStore = new MemorySessionStore();
         log.warn('Using in-memory session store (not recommended for production)');
    })();

    return initializationPromise;
}

/**
 * Get the active session store
 */
export function getSessionStore(): SessionStore {
    if (redisStore) {
        return redisStore;
    }

    if (!memoryStore) {
        memoryStore = new MemorySessionStore();
    }

    return memoryStore;
}

/**
 * Get memory store (for backward compatibility with sync operations)
 */
export function getMemoryStore(): MemorySessionStore {
    if (!memoryStore) {
        memoryStore = new MemorySessionStore();
    }
    return memoryStore;
}

/**
 * Check if using Redis
 */
export function isUsingRedis(): boolean {
    return redisStore !== null;
}

/**
 * Close connections (for graceful shutdown)
 */
export async function closeSessionStore(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        redisStore = null;
    }
    memoryStore = null;
    initializationPromise = null;
}

const sessionStoreExports = {
    initializeSessionStore,
    getSessionStore,
    getMemoryStore,
    isUsingRedis,
    closeSessionStore,
    MemorySessionStore,
    RedisSessionStore,
};

export default sessionStoreExports;
