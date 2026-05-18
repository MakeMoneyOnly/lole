/**
 * Utility Functions with JSDoc Documentation
 *
 * Addresses PLATFORM_AUDIT finding CODE-3: Missing JSDoc comments
 *
 * This module contains commonly used utility functions with comprehensive
 * JSDoc documentation for better IDE support and documentation generation.
 */

/**
 * Formats a number as Ethiopian Birr (ETB) currency string.
 *
 * @param amount - The amount to format
 * @param options - Formatting options
 * @returns Formatted currency string (e.g., "ETB 1,234.56")
 *
 * @example
 * ```ts
 * formatCurrency(1234.56); // "ETB 1,234.56"
 * formatCurrency(1234.56, { showSymbol: false }); // "1,234.56"
 * formatCurrency(1234.56, { locale: 'am-ET' }); // Ethiopian locale formatting
 * ```
 */
export function formatCurrency(
    amount: number,
    options?: {
        /** Whether to show the currency symbol */
        showSymbol?: boolean;
        /** Locale for formatting */
        locale?: string;
        /** Number of decimal places */
        decimals?: number;
    }
): string {
    const { showSymbol = true, locale = 'en-ET', decimals = 2 } = options ?? {};

    const formatter = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

    const formatted = formatter.format(amount);
    return showSymbol ? `ETB ${formatted}` : formatted;
}

/**
 * Formats a date for display in the Ethiopian context.
 *
 * @param date - Date to format (Date object, ISO string, or timestamp)
 * @param format - Format style to use
 * @returns Formatted date string
 *
 * @example
 * ```ts
 * formatDate(new Date()); // "19/02/2026"
 * formatDate(new Date(), 'long'); // "February 19, 2026"
 * formatDate(new Date(), 'relative'); // "2 hours ago"
 * formatDate(new Date(), 'am'); // "የካቲት 19, 2026" (Amharic)
 * ```
 */
export function formatDate(
    date: Date | string | number,
    format: 'short' | 'long' | 'relative' | 'time' | 'am' = 'short'
): string {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
        return 'Invalid date';
    }

    switch (format) {
        case 'short':
            return dateObj.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        case 'long':
            return dateObj.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        case 'relative':
            return formatRelativeTime(dateObj);
        case 'time':
            return dateObj.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
            });
        case 'am':
            return dateObj.toLocaleDateString('am-ET', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        default:
            return dateObj.toLocaleDateString();
    }
}

/**
 * Formats a date as relative time (e.g., "2 hours ago").
 *
 * @param date - The date to format
 * @param baseDate - The reference date (defaults to now)
 * @returns Relative time string
 *
 * @example
 * ```ts
 * formatRelativeTime(new Date(Date.now() - 3600000)); // "1 hour ago"
 * formatRelativeTime(new Date(Date.now() + 3600000)); // "in 1 hour"
 * ```
 */
export function formatRelativeTime(date: Date, baseDate: Date = new Date()): string {
    const diffMs = baseDate.getTime() - date.getTime();
    const diffSecs = Math.abs(Math.round(diffMs / 1000));
    const diffMins = Math.round(diffSecs / 60);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    const isPast = diffMs > 0;
    const suffix = isPast ? 'ago' : 'in';
    const prefix = isPast ? '' : 'in ';

    if (diffSecs < 60) {
        return isPast ? 'just now' : 'in a few seconds';
    }
    if (diffMins < 60) {
        return `${prefix}${diffMins} minute${diffMins !== 1 ? 's' : ''} ${suffix}`.trim();
    }
    if (diffHours < 24) {
        return `${prefix}${diffHours} hour${diffHours !== 1 ? 's' : ''} ${suffix}`.trim();
    }
    if (diffDays < 7) {
        return `${prefix}${diffDays} day${diffDays !== 1 ? 's' : ''} ${suffix}`.trim();
    }

    return formatDate(date, 'short');
}

/**
 * Generates a unique identifier string.
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique identifier string
 *
 * @example
 * ```ts
 * generateId(); // "abc123def456"
 * generateId('order'); // "order_abc123def456"
 * ```
 */
export function generateId(prefix?: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    const id = `${timestamp}${random}`;
    return prefix ? `${prefix}_${id}` : id;
}

/**
 * Safely parses JSON without throwing errors.
 *
 * @typeParam T - Expected type of the parsed JSON
 * @param jsonString - JSON string to parse
 * @param fallback - Value to return if parsing fails
 * @returns Parsed value or fallback
 *
 * @example
 * ```ts
 * const data = safeJsonParse<{ name: string }>('{"name":"test"}');
 * // { name: "test" }
 *
 * const fallback = safeJsonParse('invalid', { name: 'default' });
 * // { name: "default" }
 * ```
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
    try {
        return JSON.parse(jsonString) as T;
    } catch {
        return fallback;
    }
}

/**
 * Debounces a function call.
 *
 * @typeParam T - Function type
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 *
 * @example
 * ```ts
 * const debouncedSearch = debounce((query: string) => {
 *   fetchResults(query);
 * }, 300);
 *
 * // Called multiple times rapidly, only executes once after 300ms
 * debouncedSearch('test');
 * debouncedSearch('testing');
 * debouncedSearch('testing 123');
 * ```
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
            timeoutId = null;
        }, wait);
    };
}

/**
 * Throttles a function call.
 *
 * @typeParam T - Function type
 * @param func - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 *
 * @example
 * ```ts
 * const throttledScroll = throttle(() => {
 *   updateScrollPosition();
 * }, 100);
 *
 * window.addEventListener('scroll', throttledScroll);
 * ```
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * Clamps a number between a minimum and maximum value.
 *
 * @param value - Value to clamp
 * @param min - Minimum value
 * @param max - Maximum value
 * @returns Clamped value
 *
 * @example
 * ```ts
 * clamp(5, 0, 10); // 5
 * clamp(-5, 0, 10); // 0
 * clamp(15, 0, 10); // 10
 * ```
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Checks if a value is not null or undefined.
 *
 * @typeParam T - Value type
 * @param value - Value to check
 * @returns True if value is not null or undefined
 *
 * @example
 * ```ts
 * const items = [1, null, 2, undefined, 3];
 * const filtered = items.filter(notEmpty); // [1, 2, 3]
 * ```
 */
export function notEmpty<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

/**
 * Groups an array of items by a key.
 *
 * @typeParam T - Item type
 * @param items - Array of items
 * @param keyFn - Function to extract the grouping key
 * @returns Object with keys mapped to arrays of items
 *
 * @example
 * ```ts
 * const orders = [
 *   { id: 1, status: 'pending' },
 *   { id: 2, status: 'completed' },
 *   { id: 3, status: 'pending' },
 * ];
 *
 * const grouped = groupBy(orders, o => o.status);
 * // { pending: [{ id: 1, ... }, { id: 3, ... }], completed: [{ id: 2, ... }] }
 * ```
 */
export function groupBy<T, K extends string | number | symbol>(
    items: T[],
    keyFn: (item: T) => K
): Record<K, T[]> {
    return items.reduce(
        (acc, item) => {
            const key = keyFn(item);
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(item);
            return acc;
        },
        {} as Record<K, T[]>
    );
}

/**
 * Creates a promise that resolves after a specified delay.
 *
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```ts
 * await sleep(1000); // Wait 1 second
 * console.warn('Done!');
 * ```
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries a function with exponential backoff.
 *
 * @typeParam T - Return type of the function
 * @param fn - Async function to retry
 * @param options - Retry options
 * @returns Result of the function
 * @throws The last error if all retries fail
 *
 * @example
 * ```ts
 * const data = await retry(
 *   () => fetch('/api/v1/system/test').then(r => r.json()),
 *   { maxAttempts: 3, baseDelay: 1000 }
 * );
 * ```
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options?: {
        /** Maximum number of attempts */
        maxAttempts?: number;
        /** Base delay in milliseconds */
        baseDelay?: number;
        /** Maximum delay in milliseconds */
        maxDelay?: number;
        /** Function to determine if error is retryable */
        shouldRetry?: (error: Error) => boolean;
    }
): Promise<T> {
    const {
        maxAttempts = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        shouldRetry = () => true,
    } = options ?? {};

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt === maxAttempts || !shouldRetry(lastError)) {
                throw lastError;
            }

            const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
            await sleep(delay);
        }
    }

    throw lastError ?? new Error('Retry failed');
}

/**
 * Truncates a string to a maximum length with ellipsis.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add (default: "...")
 * @returns Truncated string
 *
 * @example
 * ```ts
 * truncate('Hello, world!', 5); // "He..."
 * truncate('Hello, world!', 20); // "Hello, world!" (no change)
 * ```
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
    if (str.length <= maxLength) {
        return str;
    }
    return str.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Capitalizes the first letter of a string.
 *
 * @param str - String to capitalize
 * @returns Capitalized string
 *
 * @example
 * ```ts
 * capitalize('hello'); // "Hello"
 * capitalize('HELLO'); // "HELLO"
 * ```
 */
export function capitalize(str: string): string {
    if (!str.length) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a string to title case.
 *
 * @param str - String to convert
 * @returns Title case string
 *
 * @example
 * ```ts
 * toTitleCase('hello world'); // "Hello World"
 * toTitleCase('ORDER_STATUS'); // "Order Status"
 * ```
 */
export function toTitleCase(str: string): string {
    return str.replace(/[_-]/g, ' ').split(' ').map(capitalize).join(' ');
}
