/**
 * Request Timeout Configuration
 *
 * MED-023: Provides configurable timeouts with defaults for external API calls.
 * Ensures requests don't hang indefinitely and provides graceful timeout handling.
 *
 * @module lib/api/timeout
 */

/**
 * Default timeout configurations in milliseconds
 */
export const TIMEOUT_DEFAULTS = {
    /** External API calls (payment gateways, delivery partners) - 10 seconds */
    externalApi: 10_000,
    /** Database queries - 5 seconds */
    database: 5_000,
    /** Redis operations - 2 seconds */
    redis: 2_000,
    /** Webhook calls - 5 seconds */
    webhook: 5_000,
    /** Health checks - 3 seconds */
    healthCheck: 3_000,
    /** Payment provider operations - 15 seconds */
    payment: 15_000,
    /** Delivery partner API - 8 seconds */
    delivery: 8_000,
    /** SMS/Push notifications - 5 seconds */
    notification: 5_000,
} as const;

/**
 * Timeout configuration type
 */
export type TimeoutType = keyof typeof TIMEOUT_DEFAULTS;

/**
 * Environment variable overrides for timeouts
 */
function getEnvTimeout(key: string, defaultValue: number): number {
    const envValue = process.env[key];
    if (envValue) {
        const parsed = parseInt(envValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }
    return defaultValue;
}

/**
 * Get timeout value with environment override support
 *
 * @param type - Timeout type from TIMEOUT_DEFAULTS
 * @param customValue - Optional custom value to use instead of default
 * @returns Timeout value in milliseconds
 */
export function getTimeout(type: TimeoutType, customValue?: number): number {
    if (customValue !== undefined && customValue > 0) {
        return customValue;
    }

    const envKey = `TIMEOUT_${type.toUpperCase()}`;
    return getEnvTimeout(envKey, TIMEOUT_DEFAULTS[type]);
}

/**
 * Create an AbortController with automatic timeout
 *
 * @param timeoutMs - Timeout in milliseconds
 * @returns Object with controller and timeout ID for cleanup
 */
export function createTimeoutController(timeoutMs: number): {
    controller: AbortController;
    timeoutId: NodeJS.Timeout;
    cleanup: () => void;
} {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort(new TimeoutError(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    return {
        controller,
        timeoutId,
        cleanup: () => clearTimeout(timeoutId),
    };
}

/**
 * Custom error class for timeout errors
 */
export class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TimeoutError';
    }
}

/**
 * Wrap a promise with a timeout
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param message - Optional custom timeout message
 * @returns Promise that rejects on timeout
 */
export function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message?: string
): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new TimeoutError(message || `Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        promise
            .then(result => {
                clearTimeout(timeoutId);
                resolve(result);
            })
            .catch(error => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

/**
 * Fetch with automatic timeout
 *
 * @param url - URL to fetch
 * @param options - Fetch options with optional timeout
 * @returns Response promise with timeout handling
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
    const { timeout = TIMEOUT_DEFAULTS.externalApi, ...fetchOptions } = options;
    const { controller, cleanup } = createTimeoutController(timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        return response;
    } finally {
        cleanup();
    }
}

/**
 * Type-safe fetch wrapper for external APIs with timeout and error handling
 */
export interface ExternalApiOptions {
    timeout?: number;
    headers?: Record<string, string>;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: unknown;
}

export async function externalApiCall<T>(
    url: string,
    options: ExternalApiOptions = {}
): Promise<{ data: T; latencyMs: number }> {
    const startTime = Date.now();
    const timeout = getTimeout('externalApi', options.timeout);

    const { controller, cleanup } = createTimeoutController(timeout);

    try {
        const fetchOptions: RequestInit = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            signal: controller.signal,
        };

        if (options.body) {
            fetchOptions.body = JSON.stringify(options.body);
        }

        const response = await fetch(url, fetchOptions);
        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`External API error: ${response.status} ${errorText}`);
        }

        const data = (await response.json()) as T;
        return { data, latencyMs };
    } finally {
        cleanup();
    }
}
