import type { AppError } from '../errors';

/**
 * Cache entry DTO
 */
export interface CacheEntry<T = unknown> {
    key: string;
    value: T;
    ttl?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Get from cache input DTO
 */
export interface GetCacheInput {
    key: string;
}

/**
 * Set cache input DTO
 */
export interface SetCacheInput<T = unknown> {
    key: string;
    value: T;
    ttl?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Delete from cache input DTO
 */
export interface DeleteCacheInput {
    key: string;
}

/**
 * Cache operation result
 */
export interface CacheOperationResult {
    success: boolean;
    error?: AppError;
}

/**
 * Cache get result
 */
export interface CacheGetResult<T = unknown> {
    hit: boolean;
    value?: T;
    metadata?: Record<string, unknown>;
    ttl?: number;
    error?: AppError;
}

/**
 * Increment counter input DTO
 */
export interface IncrementCacheInput {
    key: string;
    amount?: number;
    ttl?: number;
}

/**
 * Cache stats DTO
 */
export interface CacheStats {
    hits: number;
    misses: number;
    keys: number;
    memory: {
        used: number;
        max: number;
    };
}

/**
 * Cache Service Port
 * Defines the contract for caching operations
 */
export interface CacheServicePort {
    /**
     * Get a value from cache
     * @param input - Key to retrieve
     * @returns Cache result with value if found
     */
    get<T = unknown>(input: GetCacheInput): Promise<CacheGetResult<T>>;

    /**
     * Set a value in cache
     * @param input - Cache entry with value and optional TTL
     * @returns Operation result
     * @throws AppError on failure
     */
    set<T = unknown>(input: SetCacheInput<T>): Promise<CacheOperationResult>;

    /**
     * Delete a value from cache
     * @param input - Key to delete
     * @returns Operation result
     */
    delete(input: DeleteCacheInput): Promise<CacheOperationResult>;

    /**
     * Check if a key exists in cache
     * @param key - The key to check
     * @returns Whether the key exists
     */
    exists(key: string): Promise<boolean>;

    /**
     * Delete multiple keys from cache
     * @param pattern - Pattern to match keys for deletion
     * @returns Number of keys deleted
     */
    deletePattern(pattern: string): Promise<number>;

    /**
     * Increment a numeric value in cache
     * @param input - Key and amount to increment
     * @returns New value after increment
     * @throws AppError on failure
     */
    increment(input: IncrementCacheInput): Promise<number>;

    /**
     * Decrement a numeric value in cache
     * @param input - Key and amount to decrement
     * @returns New value after decrement
     * @throws AppError on failure
     */
    decrement(input: IncrementCacheInput): Promise<number>;

    /**
     * Get multiple values from cache
     * @param keys - Array of keys to retrieve
     * @returns Map of key to cached value
     */
    getMany<T = unknown>(keys: string[]): Promise<Map<string, T>>;

    /**
     * Set multiple values in cache
     * @param entries - Array of cache entries
     * @returns Operation result
     * @throws AppError on failure
     */
    setMany<T = unknown>(entries: SetCacheInput<T>[]): Promise<CacheOperationResult>;

    /**
     * Get cache statistics
     * @returns Cache statistics
     */
    getStats(): Promise<CacheStats>;

    /**
     * Clear all cache entries
     * @returns Operation result
     */
    clear(): Promise<CacheOperationResult>;

    /**
     * Acquire a distributed lock
     * @param key - Lock key
     * @param ttl - Lock TTL in milliseconds
     * @returns Lock token if acquired
     */
    acquireLock(key: string, ttl: number): Promise<string | null>;

    /**
     * Release a distributed lock
     * @param key - Lock key
     * @param token - Lock token
     * @returns Operation result
     */
    releaseLock(key: string, token: string): Promise<CacheOperationResult>;
}
