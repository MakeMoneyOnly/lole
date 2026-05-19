/**
 * Monetary Utilities - Santim Handling
 *
 * All monetary values in the lole platform are stored as INTEGER in santim.
 * 100 santim = 1 ETB (Ethiopian Birr)
 *
 * This module provides utilities for:
 * - Converting between birr and santim
 * - Formatting santim values for display
 * - Validating monetary inputs
 *
 * CRIT-02: This is the single source of truth for monetary conversions.
 */

import { clsx, type ClassValue } from 'clsx';

/**
 * Conversion constants
 */
export const SANTIM_PER_BIRR = 100;

/**
 * Converts birr (decimal) to santim (integer)
 * @param birr - Value in birr (e.g., 15.50)
 * @returns Value in santim (e.g., 1550)
 */
export function birrToSantim(birr: number): number {
    if (!Number.isFinite(birr)) return 0;
    if (birr < 0) return 0; // Negative values return 0
    return Math.round(birr * SANTIM_PER_BIRR);
}

/**
 * Converts santim (integer) to birr (decimal)
 * @param santim - Value in santim (e.g., 1550)
 * @returns Value in birr (e.g., 15.50)
 */
export function santimToBirr(santim: number): number {
    if (!Number.isFinite(santim)) return 0;
    if (santim < 0) return 0; // Negative values return 0
    return santim / SANTIM_PER_BIRR;
}

/**
 * Formats a santim value for display as birr with currency symbol
 * @param santim - Value in santim
 * @param options - Formatting options
 * @returns Formatted string (e.g., "ETB 15.50" or "15.50 ETB")
 */
export function formatCurrency(
    santim: number | null | undefined,
    options: {
        showCurrency?: boolean;
        currencySymbol?: string;
        decimals?: number;
        locale?: string;
    } = {}
): string {
    const { showCurrency = true, currencySymbol = 'Br.', decimals = 0, locale = 'en-ET' } = options;

    if (santim === null || santim === undefined || !Number.isFinite(santim)) {
        return showCurrency ? `${currencySymbol} 0` : '0';
    }

    const birrValue = santimToBirr(santim);
    // Only floor/truncate when decimals is 0 (default), otherwise show actual value
    const displayValue = decimals === 0 ? Math.floor(birrValue) : birrValue;
    const formatted = displayValue.toLocaleString(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });

    return showCurrency ? `${currencySymbol} ${formatted}` : formatted;
}

/**
 * Formats a santim value for display as birr (compact version for receipts/KDS)
 * @param santim - Value in santim
 * @returns Formatted string (e.g., "15.50")
 */
export function formatCurrencyCompact(santim: number | null | undefined): string {
    if (santim === null || santim === undefined || !Number.isFinite(santim)) {
        return '0';
    }

    // formatCurrencyCompact always uses decimals=0, so floor the value
    const birrValue = Math.floor(santimToBirr(santim));
    return birrValue.toLocaleString('en-ET');
}

/**
 * Validates that a value is a valid santim amount (non-negative integer)
 * @param value - Value to validate
 * @returns True if valid santim amount
 */
export function isValidSantim(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
    );
}

/**
 * Validates that a value is a valid birr amount (non-negative number)
 * @param value - Value to validate
 * @returns True if valid birr amount
 */
export function isValidBirr(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Ensures a value is a valid santim amount, converting from birr if needed
 * @param value - Value in either santim or birr
 * @param inputIsBirr - If true, treats value as birr and converts to santim
 * @returns Valid santim value
 */
export function toSantim(value: number, inputIsBirr: boolean = false): number {
    if (!Number.isFinite(value)) return 0;

    if (inputIsBirr) {
        return birrToSantim(value);
    }

    // Assume it's already in santim (integer)
    return Math.round(value);
}

/**
 * Parses a string input that could be either birr or santim
 * @param input - String input (e.g., "15.50" or "1550")
 * @param assumeBirr - If true and input is ambiguous, assume birr
 * @returns Value in santim
 */
export function parseCurrencyInput(input: string, assumeBirr: boolean = true): number {
    const parsed = parseFloat(input.trim());
    if (isNaN(parsed)) return 0;

    // If input has a decimal point, treat as birr
    if (input.includes('.')) {
        return birrToSantim(parsed);
    }

    // If input is a whole number:
    // - If assumeBirr is false, treat as santim
    // - If assumeBirr is true and value is small (< 10000), treat as birr
    if (assumeBirr && parsed < 10000) {
        return birrToSantim(parsed);
    }

    // Otherwise treat as santim
    return Math.round(parsed);
}

/**
 * Calculates the total from an array of line items
 * @param items - Array of items with quantity and unit_price (in santim)
 * @returns Total in santim
 */
export function calculateLineTotal(items: Array<{ quantity: number; unit_price: number }>): number {
    return items.reduce((total, item) => {
        return total + item.quantity * item.unit_price;
    }, 0);
}

/**
 * Calculates order total from order items
 * @param items - Array of order items with quantity and unit_price
 * @returns Total in santim
 */
export function calculateOrderTotal(
    items: Array<{ quantity: number; unit_price: number }>
): number {
    return calculateLineTotal(items);
}

/**
 * Calculates change to give back
 * @param amountPaid - Amount paid in santim
 * @param totalDue - Total amount due in santim
 * @returns Change amount in santim
 */
export function calculateChange(amountPaid: number, totalDue: number): number {
    const change = amountPaid - totalDue;
    return change > 0 ? change : 0;
}

/**
 * Validates that payment amount covers the order total
 * @param amountPaid - Amount paid in santim
 * @param totalDue - Total due in santim
 * @returns True if payment covers total
 */
export function isPaymentSufficient(amountPaid: number, totalDue: number): boolean {
    return amountPaid >= totalDue;
}

/**
 * Rounds a value to the nearest santim (should be a no-op but ensures consistency)
 * @param value - Value to round
 * @returns Rounded value
 */
export function roundToSantim(value: number): number {
    return Math.round(value);
}

/**
 * Utility for cn (className) from clsx
 */
export function cn(...inputs: ClassValue[]): string {
    return clsx(inputs);
}

/**
 * Type for monetary input - accepts both birr and santim
 */
export interface MonetaryInput {
    value: number;
    unit: 'birr' | 'santim';
}

/**
 * Type for a monetary value stored in santim
 */
export interface MonetaryValue {
    santim: number;
}

/**
 * Creates a monetary value object from a birr or santim input
 */
export function createMonetaryValue(
    value: number,
    unit: 'birr' | 'santim' = 'santim'
): MonetaryValue {
    return {
        santim: toSantim(value, unit === 'birr'),
    };
}

/**
 * Removes "Monday Special – ", "Tuesday Special – ", etc. prefix from food item names
 * @param title - The raw food item name
 * @returns Cleaned food item name
 */
export function cleanItemTitle(title: string | null | undefined): string {
    if (!title) return '';
    return title
        .replace(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Weekend|Weekday|Daily|Weekly)\s+Special\s*([-–—\s]\s*)?/i, '')
        .trim();
}
