/**
 * Circuit Breaker Pattern Implementation
 *
 * MED-024: Implements circuit breaker for external service calls (payment gateways, delivery partners).
 * Prevents cascading failures and provides automatic recovery.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit tripped, requests fail fast
 * - HALF_OPEN: Testing if service recovered
 *
 * @module lib/api/circuit-breaker
 */

import { logger } from '@/lib/logger';

/**
 * Circuit breaker states
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
    /** Name of the service for logging */
    name: string;
    /** Number of failures before opening circuit */
    failureThreshold: number;
    /** Number of successes in half-open state to close circuit */
    successThreshold: number;
    /** Time in ms before attempting to close circuit (from open state) */
    resetTimeout: number;
    /** Time window in ms for counting failures */
    failureWindow: number;
    /** Enable logging */
    enableLogging?: boolean;
}

/**
 * Default configurations for common services
 */
export const CIRCUIT_BREAKER_DEFAULTS = {
    payment: {
        name: 'payment',
        failureThreshold: 5,
        successThreshold: 2,
        resetTimeout: 30_000, // 30 seconds
        failureWindow: 60_000, // 1 minute
    },
    delivery: {
        name: 'delivery',
        failureThreshold: 5,
        successThreshold: 2,
        resetTimeout: 30_000,
        failureWindow: 60_000,
    },
    notification: {
        name: 'notification',
        failureThreshold: 10,
        successThreshold: 2,
        resetTimeout: 15_000,
        failureWindow: 60_000,
    },
    webhook: {
        name: 'webhook',
        failureThreshold: 5,
        successThreshold: 2,
        resetTimeout: 60_000,
        failureWindow: 120_000,
    },
} as const;

/**
 * Internal state tracking
 */
interface CircuitBreakerState {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
    lastStateChange: number;
    failures: number[]; // Timestamps of recent failures
}

/**
 * Result of a circuit breaker operation
 */
export interface CircuitBreakerResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    circuitState: CircuitState;
    latencyMs: number;
}

/**
 * Circuit breaker error
 */
export class CircuitBreakerError extends Error {
    public readonly circuitState: CircuitState;
    public readonly serviceName: string;

    constructor(serviceName: string, state: CircuitState) {
        super(`Circuit breaker is ${state} for service: ${serviceName}`);
        this.name = 'CircuitBreakerError';
        this.circuitState = state;
        this.serviceName = serviceName;
    }
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
    private config: CircuitBreakerConfig;
    private state: CircuitBreakerState;
    private readonly logPrefix: string;

    constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
        this.config = {
            failureThreshold: 5,
            successThreshold: 2,
            resetTimeout: 30_000,
            failureWindow: 60_000,
            enableLogging: true,
            ...config,
        };

        this.state = {
            state: 'CLOSED',
            failureCount: 0,
            successCount: 0,
            lastFailureTime: null,
            lastStateChange: Date.now(),
            failures: [],
        };

        this.logPrefix = `[CircuitBreaker:${this.config.name}]`;
    }

    /**
     * Get current circuit state
     */
    getState(): CircuitState {
        this.updateState();
        return this.state.state;
    }

    /**
     * Check if requests can be made
     */
    canExecute(): boolean {
        this.updateState();
        return this.state.state !== 'OPEN';
    }

    /**
     * Execute a function through the circuit breaker
     *
     * @param fn - Async function to execute
     * @returns Result with success/failure status
     */
    async execute<T>(fn: () => Promise<T>): Promise<CircuitBreakerResult<T>> {
        const startTime = Date.now();

        // Update state based on time
        this.updateState();

        // Check if circuit is open
        if (this.state.state === 'OPEN') {
            this.log('warn', 'Circuit is OPEN, failing fast');
            throw new CircuitBreakerError(this.config.name, 'OPEN');
        }

        try {
            const result = await fn();
            const latencyMs = Date.now() - startTime;

            this.onSuccess();
            this.log('debug', `Request succeeded in ${latencyMs}ms`);

            return {
                success: true,
                data: result,
                circuitState: this.state.state,
                latencyMs,
            };
        } catch (error) {
            const latencyMs = Date.now() - startTime;
            this.onFailure();

            this.log(
                'warn',
                `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            );

            return {
                success: false,
                error: error instanceof Error ? error : new Error('Unknown error'),
                circuitState: this.state.state,
                latencyMs,
            };
        }
    }

    /**
     * Execute with fallback function
     *
     * @param fn - Primary function to execute
     * @param fallback - Fallback function if circuit is open or primary fails
     * @returns Result from primary or fallback
     */
    async executeWithFallback<T>(
        fn: () => Promise<T>,
        fallback: () => Promise<T>
    ): Promise<CircuitBreakerResult<T>> {
        try {
            return await this.execute(fn);
        } catch (error) {
            if (error instanceof CircuitBreakerError) {
                this.log('info', 'Using fallback due to open circuit');
                const startTime = Date.now();
                try {
                    const result = await fallback();
                    return {
                        success: true,
                        data: result,
                        circuitState: this.state.state,
                        latencyMs: Date.now() - startTime,
                    };
                } catch (fallbackError) {
                    return {
                        success: false,
                        error:
                            fallbackError instanceof Error
                                ? fallbackError
                                : new Error('Fallback failed'),
                        circuitState: this.state.state,
                        latencyMs: Date.now() - startTime,
                    };
                }
            }
            throw error;
        }
    }

    /**
     * Record a successful operation
     */
    private onSuccess(): void {
        this.state.successCount++;

        if (this.state.state === 'HALF_OPEN') {
            if (this.state.successCount >= this.config.successThreshold) {
                this.transitionTo('CLOSED');
            }
        } else {
            // Reset failure count on success in closed state
            this.state.failureCount = 0;
            this.state.failures = [];
        }
    }

    /**
     * Record a failed operation
     */
    private onFailure(): void {
        const now = Date.now();
        this.state.lastFailureTime = now;
        this.state.failures.push(now);

        // Clean up old failures outside the window
        const windowStart = now - this.config.failureWindow;
        this.state.failures = this.state.failures.filter(t => t >= windowStart);

        this.state.failureCount = this.state.failures.length;

        if (this.state.state === 'HALF_OPEN') {
            // Any failure in half-open state opens the circuit
            this.transitionTo('OPEN');
        } else if (this.state.state === 'CLOSED') {
            if (this.state.failureCount >= this.config.failureThreshold) {
                this.transitionTo('OPEN');
            }
        }
    }

    /**
     * Update state based on time (for half-open to open transition)
     */
    private updateState(): void {
        if (this.state.state === 'OPEN') {
            const now = Date.now();
            const timeSinceOpen = now - this.state.lastStateChange;

            if (timeSinceOpen >= this.config.resetTimeout) {
                this.transitionTo('HALF_OPEN');
            }
        }
    }

    /**
     * Transition to a new state
     */
    private transitionTo(newState: CircuitState): void {
        const oldState = this.state.state;
        this.state.state = newState;
        this.state.lastStateChange = Date.now();

        // Reset counters on state change
        if (newState === 'CLOSED') {
            this.state.failureCount = 0;
            this.state.successCount = 0;
            this.state.failures = [];
        } else if (newState === 'HALF_OPEN') {
            this.state.successCount = 0;
        } else if (newState === 'OPEN') {
            this.state.successCount = 0;
        }

        this.log('info', `State transition: ${oldState} -> ${newState}`);
    }

    /**
     * Log with prefix
     */
    private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
        if (!this.config.enableLogging) return;

        switch (level) {
            case 'debug':
                logger.debug(`${this.logPrefix} ${message}`);
                break;
            case 'info':
                logger.info(`${this.logPrefix} ${message}`);
                break;
            case 'warn':
                logger.warn(`${this.logPrefix} ${message}`);
                break;
            case 'error':
                logger.error(`${this.logPrefix} ${message}`);
                break;
        }
    }

    /**
     * Get current stats for monitoring
     */
    getStats(): {
        state: CircuitState;
        failureCount: number;
        successCount: number;
        lastFailureTime: number | null;
        lastStateChange: number;
        uptime: number;
    } {
        return {
            state: this.state.state,
            failureCount: this.state.failureCount,
            successCount: this.state.successCount,
            lastFailureTime: this.state.lastFailureTime,
            lastStateChange: this.state.lastStateChange,
            uptime: Date.now() - this.state.lastStateChange,
        };
    }

    /**
     * Force reset the circuit breaker (for admin operations)
     */
    reset(): void {
        this.state = {
            state: 'CLOSED',
            failureCount: 0,
            successCount: 0,
            lastFailureTime: null,
            lastStateChange: Date.now(),
            failures: [],
        };
        this.log('info', 'Circuit breaker reset');
    }
}

/**
 * Circuit breaker registry for managing multiple services
 */
class CircuitBreakerRegistry {
    private breakers: Map<string, CircuitBreaker> = new Map();

    /**
     * Get or create a circuit breaker for a service
     */
    getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
        let breaker = this.breakers.get(name);
        if (!breaker) {
            breaker = new CircuitBreaker({ name, ...config });
            this.breakers.set(name, breaker);
        }
        return breaker;
    }

    /**
     * Get all circuit breakers
     */
    getAllBreakers(): Map<string, CircuitBreaker> {
        return new Map(this.breakers);
    }

    /**
     * Get health status of all circuit breakers
     */
    getHealthStatus(): Record<string, { state: CircuitState; failureCount: number }> {
        const status: Record<string, { state: CircuitState; failureCount: number }> = {};
        for (const [name, breaker] of this.breakers) {
            const stats = breaker.getStats();
            status[name] = {
                state: stats.state,
                failureCount: stats.failureCount,
            };
        }
        return status;
    }

    /**
     * Reset all circuit breakers
     */
    resetAll(): void {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
    }
}

// Singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Create a circuit breaker for a payment provider
 */
export function createPaymentCircuitBreaker(providerName: string): CircuitBreaker {
    return circuitBreakerRegistry.getBreaker(`payment:${providerName}`, {
        ...CIRCUIT_BREAKER_DEFAULTS.payment,
        name: `payment:${providerName}`,
    });
}

/**
 * Create a circuit breaker for a delivery partner
 */
export function createDeliveryCircuitBreaker(partnerName: string): CircuitBreaker {
    return circuitBreakerRegistry.getBreaker(`delivery:${partnerName}`, {
        ...CIRCUIT_BREAKER_DEFAULTS.delivery,
        name: `delivery:${partnerName}`,
    });
}
