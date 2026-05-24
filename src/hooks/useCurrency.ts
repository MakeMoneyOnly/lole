/**
 * useCurrency Hook - Format monetary values for display
 *
 * CRIT-02: All monetary values are stored as INTEGER in SANTIM (100 santim = 1 ETB)
 * This hook provides utilities for formatting values for display in the UI.
 *
 * Usage:
 *   const { formatCurrency, formatCurrencyCompact } = useCurrency();
 *   formatCurrency(1550) // "ETB 15.50"
 *   formatCurrencyCompact(1550) // "15.50"
 */

'use client';

import { useCallback } from 'react';
import {
    formatCurrency as formatCurrencyUtil,
    formatCurrencyCompact as formatCurrencyCompactUtil,
    SANTIM_PER_BIRR,
} from '@/lib/utils/monetary';

export interface UseCurrencyOptions {
    showCurrency?: boolean;
    currencySymbol?: string;
    decimals?: number;
    locale?: string;
}

export interface UseCurrencyReturn {
    /**
     * Format a santim value for display as birr with currency symbol
     * @param santim - Value in santim (integer)
     * @param options - Formatting options
     * @returns Formatted string (e.g., "ETB 15.50")
     */
    formatCurrency: (santim: number | null | undefined, options?: UseCurrencyOptions) => string;

    /**
     * Format a santim value for compact display (no currency symbol)
     * @param santim - Value in santim (integer)
     * @returns Formatted string (e.g., "15.50")
     */
    formatCurrencyCompact: (santim: number | null | undefined) => string;

    /**
     * Convert birr to santim
     * @param birr - Value in birr
     * @returns Value in santim
     */
    birrToSantim: (birr: number) => number;

    /**
     * Convert santim to birr
     * @param santim - Value in santim
     * @returns Value in birr
     */
    santimToBirr: (santim: number) => number;

    /**
     * Calculate the total from line items
     * @param items - Array of items with quantity and unit_price
     * @returns Total in santim
     */
    calculateTotal: (items: Array<{ quantity: number; unit_price: number }>) => number;
}

export function useCurrency(options?: UseCurrencyOptions): UseCurrencyReturn {
    const formatCurrency = useCallback(
        (santim: number | null | undefined, formatOptions?: UseCurrencyOptions) => {
            return formatCurrencyUtil(santim, {
                ...options,
                ...formatOptions,
            });
        },
        [options]
    );

    const formatCurrencyCompact = useCallback((santim: number | null | undefined) => {
        return formatCurrencyCompactUtil(santim);
    }, []);

    const birrToSantim = useCallback((birr: number) => {
        return Math.round(birr * SANTIM_PER_BIRR);
    }, []);

    const santimToBirr = useCallback((santim: number) => {
        return santim / SANTIM_PER_BIRR;
    }, []);

    const calculateTotal = useCallback((items: Array<{ quantity: number; unit_price: number }>) => {
        return items.reduce((total, item) => {
            return total + item.quantity * item.unit_price;
        }, 0);
    }, []);

    return {
        formatCurrency,
        formatCurrencyCompact,
        birrToSantim,
        santimToBirr,
        calculateTotal,
    };
}
