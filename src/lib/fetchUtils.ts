/**
 * Fetch utilities with timeout and error handling
 *
 * Addresses: Inconsistent error handling patterns (High Priority Audit Finding #4)
 * Provides standardized fetch with timeout, abort support, and error handling
 */

export interface FetchOptions extends RequestInit {
    timeout?: number;
}

export interface FetchResult<T> {
    data: T | null;
    error: Error | null;
    status: number;
}

/**
 * Fetch with timeout support using AbortController
 *
 * @param url - URL to fetch
 * @param options - Fetch options with optional timeout (default: 10000ms)
 * @returns Response object
 * @throws Error if timeout or network error occurs
 */
export async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
    const { timeout = 10000, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Safe fetch with standardized error handling
 * Returns data/error object instead of throwing
 *
 * @param url - URL to fetch
 * @param options - Fetch options with optional timeout
 * @returns FetchResult with data, error, and status
 */
export async function safeFetch<T>(
    url: string,
    options: FetchOptions = {}
): Promise<FetchResult<T>> {
    try {
        const response = await fetchWithTimeout(url, options);

        if (!response.ok) {
            return {
                data: null,
                error: new Error(`HTTP ${response.status}: ${response.statusText}`),
                status: response.status,
            };
        }

        const data = (await response.json()) as T;
        return { data, error: null, status: response.status };
    } catch (error) {
        if (error instanceof Error) {
            return {
                data: null,
                error: error,
                status: 0,
            };
        }
        return {
            data: null,
            error: new Error(typeof error === 'string' ? error : 'Unknown error'),
            status: 0,
        };
    }
}

/**
 * Post JSON data with timeout and standardized error handling
 *
 * @param url - URL to post to
 * @param data - Data to send (will be JSON.stringify'd)
 * @param timeout - Timeout in milliseconds (default: 10000)
 * @returns FetchResult with response data
 */
export async function postJSON<T>(
    url: string,
    data: unknown,
    timeout = 10000
): Promise<FetchResult<T>> {
    return safeFetch<T>(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        timeout,
    });
}

/**
 * Type guard to check if fetch error is a timeout
 */
export function isTimeoutError(error: Error): boolean {
    return (
        error.name === 'AbortError' ||
        error.message.toLowerCase().includes('timeout') ||
        error.message.toLowerCase().includes('aborted') ||
        error.message.toLowerCase().includes('signal is aborted')
    );
}

/**
 * Type guard to check if fetch error is a network error
 */
export function isNetworkError(error: Error): boolean {
    return (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('Failed to fetch')
    );
}
