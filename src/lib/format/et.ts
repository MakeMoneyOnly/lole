/**
 * Ethiopian Formatting Utilities
 *
 * LOW-005: Consolidated currency formatting
 * This module provides locale-aware formatting for Ethiopian context.
 * For internal monetary calculations, use src/lib/utils/monetary.ts
 *
 * @module lib/format/et
 */

import { AppLocale, resolveIntlLocale } from '@/lib/i18n/locale';
import { santimToBirr } from '@/lib/utils/monetary';

/**
 * Format ETB currency from birr value (decimal)
 *
 * @param amount - Amount in birr (decimal, e.g., 15.50)
 * @param options - Formatting options
 * @returns Formatted currency string
 *
 * @example
 * formatETBCurrency(15.50) // "ETB 15.50" or "ብር 15.50" (Amharic)
 * formatETBCurrency(1500, { compact: true }) // "ETB 1.5K"
 */
export function formatETBCurrency(
    amount: number,
    options?: {
        locale?: AppLocale;
        maximumFractionDigits?: number;
        minimumFractionDigits?: number;
        compact?: boolean;
        showCurrencySymbol?: boolean;
    }
): string {
    const locale = options?.locale ?? 'am';
    const showCurrencySymbol = options?.showCurrencySymbol ?? true;
    const formattingOptions: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'ETB',
        // Default to 0 fraction digits based on Ethiopian conventions
        maximumFractionDigits: options?.maximumFractionDigits ?? 0,
        minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    };

    if (options?.compact) {
        // Compact notation for currency can be tricky in some locales.
        // We use 'en' as a reliable base for the 'K', 'M' symbols.
        const numFormatter = new Intl.NumberFormat('en', {
            notation: 'compact',
            compactDisplay: 'short',
            maximumFractionDigits: 1,
        });
        const formattedNumber = numFormatter.format(amount);
        return showCurrencySymbol ? `ETB ${formattedNumber}` : formattedNumber;
    }

    const formatted = new Intl.NumberFormat(resolveIntlLocale(locale), formattingOptions).format(
        amount
    );
    return showCurrencySymbol ? formatted : formatted.replace(/ETB|ብር/g, '').trim();
}

/**
 * Format ETB currency from santim value (integer)
 *
 * This is the preferred function for displaying monetary values stored in the database.
 * All monetary values in lole are stored as integers in santim (100 santim = 1 ETB).
 *
 * @param santim - Amount in santim (integer, e.g., 1550 for 15.50 ETB)
 * @param options - Formatting options
 * @returns Formatted currency string
 *
 * @example
 * formatETBFromSantim(1550) // "ETB 15.50" or "ብር 15.50" (Amharic)
 * formatETBFromSantim(1550, { decimals: 2 }) // "ETB 15.50"
 */
export function formatETBFromSantim(
    santim: number | null | undefined,
    options?: {
        locale?: AppLocale;
        maximumFractionDigits?: number;
        minimumFractionDigits?: number;
        decimals?: number;
        showCurrencySymbol?: boolean;
    }
): string {
    if (santim === null || santim === undefined || !Number.isFinite(santim)) {
        return options?.showCurrencySymbol !== false ? 'ETB 0' : '0';
    }

    const birrValue = santimToBirr(santim);
    const decimals = options?.decimals ?? 0;

    return formatETBCurrency(birrValue, {
        ...options,
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
    });
}

/**
 * Format a localized date string
 *
 * @param iso - ISO date string
 * @param locale - Target locale
 * @returns Formatted date string
 */
export function formatLocalizedDate(iso: string, locale: AppLocale): string {
    return new Date(iso).toLocaleDateString(resolveIntlLocale(locale));
}

/**
 * Format a localized date and time string
 *
 * @param iso - ISO date string
 * @param locale - Target locale
 * @returns Formatted date and time string
 */
export function formatLocalizedDateTime(iso: string, locale: AppLocale): string {
    return new Date(iso).toLocaleString(resolveIntlLocale(locale));
}

/**
 * Format a number with locale-aware grouping
 *
 * @param value - Number to format
 * @param locale - Target locale
 * @param options - Intl.NumberFormatOptions
 * @returns Formatted number string
 */
export function formatLocalizedNumber(
    value: number,
    locale: AppLocale,
    options?: Intl.NumberFormatOptions
): string {
    return new Intl.NumberFormat(resolveIntlLocale(locale), options).format(value);
}
