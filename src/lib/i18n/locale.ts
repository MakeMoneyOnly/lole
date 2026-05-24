/**
 * Locale Configuration for lole Restaurant OS
 *
 * LOW-001: Default locale detection for Ethiopian market
 * - Supports browser header detection
 * - Defaults to 'am' (Amharic) for Ethiopian IP ranges
 * - Falls back to 'en' (English) as secondary default
 */

export type AppLocale = 'en' | 'am';

/**
 * Default app locale - set to 'am' for Ethiopian market
 * This can be overridden by user preference or browser detection
 */
export const DEFAULT_APP_LOCALE: AppLocale = 'am';

/**
 * Ethiopian IP prefix ranges (major ISPs)
 * Used for geo-based locale detection
 */
const ETHIOPIAN_IP_PREFIXES = [
    '41.', // Ethio Telecom
    '196.', // Ethio Telecom
    '197.', // Ethio Telecom
    '2.', // African regional
];

/**
 * Detect locale from Accept-Language header
 * @param acceptLanguage - The Accept-Language header value
 * @returns Detected AppLocale
 */
export function detectLocaleFromHeader(acceptLanguage: string | null | undefined): AppLocale {
    if (!acceptLanguage) return DEFAULT_APP_LOCALE;

    const languages = acceptLanguage
        .split(',')
        .map(lang => lang.split(';')[0].trim().toLowerCase());

    // Check for Amharic preference
    if (languages.some(lang => lang.startsWith('am'))) {
        return 'am';
    }

    // Check for Ethiopian locale variant
    if (languages.some(lang => lang.includes('-et'))) {
        return 'am';
    }

    // Default to Amharic for Ethiopian market, English as fallback
    return languages.some(lang => lang.startsWith('en')) ? 'en' : DEFAULT_APP_LOCALE;
}

/**
 * Detect locale from IP address (server-side)
 * @param ipAddress - The client IP address
 * @returns Detected AppLocale based on IP geolocation
 */
export function detectLocaleFromIP(ipAddress: string | null | undefined): AppLocale | null {
    if (!ipAddress) return null;

    // Check if IP is from Ethiopian ranges
    const isEthiopian = ETHIOPIAN_IP_PREFIXES.some(prefix => ipAddress.startsWith(prefix));

    return isEthiopian ? 'am' : null;
}

/**
 * Resolve locale with fallback chain
 * Priority: user preference > browser header > IP detection > default
 */
export function resolveLocale(options?: {
    userPreference?: AppLocale | null;
    acceptLanguage?: string | null;
    clientIP?: string | null;
}): AppLocale {
    // 1. User preference takes highest priority
    if (options?.userPreference) {
        return options.userPreference;
    }

    // 2. Browser Accept-Language header
    const headerLocale = detectLocaleFromHeader(options?.acceptLanguage);
    if (headerLocale) {
        return headerLocale;
    }

    // 3. IP-based detection (for Ethiopian users)
    const ipLocale = detectLocaleFromIP(options?.clientIP);
    if (ipLocale) {
        return ipLocale;
    }

    // 4. Default to Amharic for Ethiopian market
    return DEFAULT_APP_LOCALE;
}

export function normalizeLocale(input: string | null | undefined): AppLocale {
    if (!input) return DEFAULT_APP_LOCALE;
    const value = input.toLowerCase().trim();
    if (value.startsWith('am')) return 'am';
    return 'en';
}

export function resolveIntlLocale(locale: AppLocale): string {
    return locale === 'am' ? 'am-ET' : 'en-ET';
}
