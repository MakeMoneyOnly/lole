/**
 * Graceful Degradation Utilities
 *
 * MED-028: Provides fallback responses for non-critical service failures.
 * Ensures core functionality remains available when dependent services fail.
 *
 * @module lib/api/graceful-degradation
 */

import { logger } from '@/lib/logger';
import { CircuitBreaker, CircuitBreakerError } from './circuit-breaker';

/**
 * Service health status
 */
export type ServiceHealth = 'healthy' | 'degraded' | 'unavailable';

/**
 * Service status map
 */
export interface ServiceStatus {
    name: string;
    health: ServiceHealth;
    message?: string;
    lastChecked: string;
}

/**
 * Fallback response configuration
 */
export interface FallbackConfig<T> {
    /** Default value to return when service is unavailable */
    defaultValue: T;
    /** Whether to cache successful responses for fallback */
    cacheEnabled?: boolean;
    /** Cache TTL in milliseconds */
    cacheTTL?: number;
    /** Custom error handler */
    onError?: (error: Error) => void;
    /** Whether to log degradation events */
    logDegradation?: boolean;
}

/**
 * Cached response with expiry
 */
interface CachedResponse<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

/**
 * Graceful degradation wrapper for async operations
 */
export class GracefulService<T> {
    private name: string;
    private config: FallbackConfig<T>;
    private cache: CachedResponse<T> | null = null;
    private circuitBreaker: CircuitBreaker;

    constructor(name: string, config: FallbackConfig<T>) {
        this.name = name;
        this.config = {
            cacheEnabled: true,
            cacheTTL: 5 * 60 * 1000, // 5 minutes
            logDegradation: true,
            ...config,
        };
        this.circuitBreaker = new CircuitBreaker({
            name: `graceful:${name}`,
            failureThreshold: 3,
            successThreshold: 1,
            resetTimeout: 30_000,
        });
    }

    /**
     * Execute a function with graceful degradation
     */
    async execute(fn: () => Promise<T>): Promise<{
        data: T;
        source: 'primary' | 'cache' | 'fallback';
        degraded: boolean;
    }> {
        // Try primary function through circuit breaker
        try {
            const result = await this.circuitBreaker.execute(fn);

            if (result.success && result.data !== undefined) {
                // Cache successful response
                if (this.config.cacheEnabled) {
                    this.cache = {
                        data: result.data,
                        timestamp: Date.now(),
                        ttl: this.config.cacheTTL || 5 * 60 * 1000,
                    };
                }

                return {
                    data: result.data,
                    source: 'primary',
                    degraded: false,
                };
            }
        } catch (error) {
            if (error instanceof CircuitBreakerError) {
                this.logDegradation('Circuit breaker open, using fallback');
            } else {
                this.logDegradation(
                    `Primary failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                );
                this.config.onError?.(error instanceof Error ? error : new Error('Unknown error'));
            }
        }

        // Try cached response
        if (this.config.cacheEnabled && this.cache && this.isCacheValid()) {
            this.logDegradation('Using cached response');
            return {
                data: this.cache.data,
                source: 'cache',
                degraded: true,
            };
        }

        // Return fallback
        this.logDegradation('Using fallback default value');
        return {
            data: this.config.defaultValue,
            source: 'fallback',
            degraded: true,
        };
    }

    /**
     * Check if cached response is still valid
     */
    private isCacheValid(): boolean {
        if (!this.cache) return false;
        return Date.now() - this.cache.timestamp < this.cache.ttl;
    }

    /**
     * Log degradation event
     */
    private logDegradation(message: string): void {
        if (this.config.logDegradation) {
            logger.warn(`[GracefulDegradation:${this.name}] ${message}`);
        }
    }

    /**
     * Get current service status
     */
    getStatus(): ServiceStatus {
        const stats = this.circuitBreaker.getStats();
        let health: ServiceHealth;

        if (stats.state === 'CLOSED') {
            health = 'healthy';
        } else if (stats.state === 'HALF_OPEN') {
            health = 'degraded';
        } else {
            health = this.cache && this.isCacheValid() ? 'degraded' : 'unavailable';
        }

        return {
            name: this.name,
            health,
            message: `Circuit state: ${stats.state}`,
            lastChecked: new Date().toISOString(),
        };
    }

    /**
     * Reset the service (clear cache and circuit breaker)
     */
    reset(): void {
        this.cache = null;
        this.circuitBreaker.reset();
    }
}

/**
 * Pre-configured graceful services for common use cases
 */

/**
 * Menu service with graceful degradation
 * Returns cached menu or empty array when unavailable
 */
export function createGracefulMenuService(): GracefulService<
    Array<{
        id: string;
        name: string;
        price: number;
    }>
> {
    return new GracefulService('menu', {
        defaultValue: [],
        cacheEnabled: true,
        cacheTTL: 10 * 60 * 1000, // 10 minutes
    });
}

/**
 * Notification service with graceful degradation
 * Returns success even if notification fails (non-critical)
 */
export function createGracefulNotificationService(): GracefulService<{
    sent: boolean;
    queued: boolean;
}> {
    return new GracefulService('notification', {
        defaultValue: { sent: false, queued: true }, // Queued for retry
        cacheEnabled: false,
    });
}

/**
 * Analytics service with graceful degradation
 * Returns empty stats when unavailable
 */
export function createGracefulAnalyticsService(): GracefulService<{
    orders: number;
    revenue: number;
}> {
    return new GracefulService('analytics', {
        defaultValue: { orders: 0, revenue: 0 },
        cacheEnabled: true,
        cacheTTL: 60 * 1000, // 1 minute
    });
}

/**
 * Delivery partner service with graceful degradation
 */
export function createGracefulDeliveryService(): GracefulService<{
    available: boolean;
    estimatedTime?: number;
}> {
    return new GracefulService('delivery', {
        defaultValue: { available: false },
        cacheEnabled: true,
        cacheTTL: 30 * 1000, // 30 seconds
    });
}

/**
 * Loyalty service with graceful degradation
 */
export function createGracefulLoyaltyService(): GracefulService<{
    points: number;
    tier: string;
}> {
    return new GracefulService('loyalty', {
        defaultValue: { points: 0, tier: 'standard' },
        cacheEnabled: true,
        cacheTTL: 60 * 1000, // 1 minute
    });
}

/**
 * Feature flags service with graceful degradation
 */
export function createGracefulFeatureFlagService(): GracefulService<Record<string, boolean>> {
    return new GracefulService('feature-flags', {
        defaultValue: {}, // All features disabled by default
        cacheEnabled: true,
        cacheTTL: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Service registry for monitoring all graceful services
 */
class GracefulServiceRegistry {
    private services: Map<string, GracefulService<unknown>> = new Map();

    register<T>(name: string, service: GracefulService<T>): void {
        this.services.set(name, service as GracefulService<unknown>);
    }

    get(name: string): GracefulService<unknown> | undefined {
        return this.services.get(name);
    }

    getAllStatuses(): ServiceStatus[] {
        return Array.from(this.services.values()).map(service => service.getStatus());
    }

    getHealthSummary(): {
        healthy: number;
        degraded: number;
        unavailable: number;
        services: ServiceStatus[];
    } {
        const statuses = this.getAllStatuses();
        return {
            healthy: statuses.filter(s => s.health === 'healthy').length,
            degraded: statuses.filter(s => s.health === 'degraded').length,
            unavailable: statuses.filter(s => s.health === 'unavailable').length,
            services: statuses,
        };
    }
}

// Singleton registry
export const gracefulServiceRegistry = new GracefulServiceRegistry();

/**
 * Execute with fallback - simpler utility function
 */
export async function withFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackValue: T,
    options?: {
        onError?: (error: Error) => void;
        logError?: boolean;
    }
): Promise<T> {
    try {
        return await primaryFn();
    } catch (error) {
        if (options?.logError !== false) {
            logger.warn(
                `Primary operation failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
        options?.onError?.(error instanceof Error ? error : new Error('Unknown error'));
        return fallbackValue;
    }
}

/**
 * Execute with retry and fallback
 */
export async function withRetryAndFallback<T>(
    primaryFn: () => Promise<T>,
    fallbackValue: T,
    options?: {
        maxRetries?: number;
        retryDelay?: number;
        onError?: (error: Error) => void;
    }
): Promise<T> {
    const maxRetries = options?.maxRetries ?? 2;
    const retryDelay = options?.retryDelay ?? 1000;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await primaryFn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error');

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
            }
        }
    }

    options?.onError?.(lastError!);
    logger.warn(`All retries failed, using fallback: ${lastError!.message}`);
    return fallbackValue;
}

/**
 * Batch operation with partial failure handling
 */
export async function batchWithPartialFailure<T, R>(
    items: T[],
    processFn: (item: T) => Promise<R>,
    options?: {
        continueOnError?: boolean;
        onItemError?: (item: T, error: Error) => void;
    }
): Promise<{
    successful: Array<{ item: T; result: R }>;
    failed: Array<{ item: T; error: Error }>;
}> {
    const successful: Array<{ item: T; result: R }> = [];
    const failed: Array<{ item: T; error: Error }> = [];

    for (const item of items) {
        try {
            const result = await processFn(item);
            successful.push({ item, result });
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown error');
            failed.push({ item, error: err });
            options?.onItemError?.(item, err);

            if (!options?.continueOnError) {
                break;
            }
        }
    }

    return { successful, failed };
}
