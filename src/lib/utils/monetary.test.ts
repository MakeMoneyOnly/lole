/**
 * Monetary Utilities Tests
 *
 * CRIT-02: Tests for the santim-based monetary utilities
 */

import { describe, it, expect } from 'vitest';
import {
    birrToSantim,
    santimToBirr,
    formatCurrency,
    formatCurrencyCompact,
    isValidSantim,
    isValidBirr,
    toSantim,
    parseCurrencyInput,
    calculateLineTotal,
    calculateChange,
    isPaymentSufficient,
    SANTIM_PER_BIRR,
} from '@/lib/utils/monetary';

describe('monetary utilities', () => {
    describe('birrToSantim', () => {
        it('converts birr to santim correctly', () => {
            expect(birrToSantim(15.5)).toBe(1550);
            expect(birrToSantim(100)).toBe(10000);
            expect(birrToSantim(0)).toBe(0);
            expect(birrToSantim(0.01)).toBe(1);
        });

        it('handles edge cases', () => {
            expect(birrToSantim(0.005)).toBe(1); // rounding
            expect(birrToSantim(-5)).toBe(0);
            expect(birrToSantim(NaN)).toBe(0);
        });
    });

    describe('santimToBirr', () => {
        it('converts santim to birr correctly', () => {
            expect(santimToBirr(1550)).toBe(15.5);
            expect(santimToBirr(10000)).toBe(100);
            expect(santimToBirr(0)).toBe(0);
            expect(santimToBirr(1)).toBe(0.01);
        });

        it('handles edge cases', () => {
            expect(santimToBirr(-5)).toBe(0);
            expect(santimToBirr(NaN)).toBe(0);
        });
    });

    describe('formatCurrency', () => {
        it('formats currency with default options', () => {
            expect(formatCurrency(1550)).toBe('Br. 15');
            expect(formatCurrency(0)).toBe('Br. 0');
            expect(formatCurrency(null)).toBe('Br. 0');
        });

        it('formats currency without currency symbol', () => {
            expect(formatCurrency(1550, { showCurrency: false })).toBe('15');
        });

        it('handles null and undefined', () => {
            expect(formatCurrency(null)).toBe('Br. 0');
            expect(formatCurrency(undefined)).toBe('Br. 0');
        });

        it('formats with custom decimals', () => {
            expect(formatCurrency(1550, { decimals: 2 })).toBe('Br. 15.50');
        });
    });

    describe('formatCurrencyCompact', () => {
        it('formats compact currency correctly', () => {
            expect(formatCurrencyCompact(1550)).toBe('15');
            expect(formatCurrencyCompact(0)).toBe('0');
            expect(formatCurrencyCompact(null)).toBe('0');
        });
    });

    describe('isValidSantim', () => {
        it('validates santim correctly', () => {
            expect(isValidSantim(1550)).toBe(true);
            expect(isValidSantim(0)).toBe(true);
            expect(isValidSantim(15.5)).toBe(false); // not integer
            expect(isValidSantim(-1)).toBe(false); // negative
            expect(isValidSantim('1550')).toBe(false); // string
        });
    });

    describe('isValidBirr', () => {
        it('validates birr correctly', () => {
            expect(isValidBirr(15.5)).toBe(true);
            expect(isValidBirr(0)).toBe(true);
            expect(isValidBirr(-1)).toBe(false);
            expect(isValidBirr('15.50')).toBe(false);
        });
    });

    describe('toSantim', () => {
        it('converts to santim from santim', () => {
            expect(toSantim(1550, false)).toBe(1550);
        });

        it('converts to santim from birr', () => {
            expect(toSantim(15.5, true)).toBe(1550);
        });

        it('handles invalid input', () => {
            expect(toSantim(NaN)).toBe(0);
            expect(toSantim(Infinity)).toBe(0);
        });
    });

    describe('parseCurrencyInput', () => {
        it('parses decimal input as birr', () => {
            expect(parseCurrencyInput('15.50')).toBe(1550);
        });

        it('parses whole number input as birr (when assumeBirr is true)', () => {
            expect(parseCurrencyInput('15')).toBe(1500);
        });

        it('parses large whole number as santim', () => {
            expect(parseCurrencyInput('15000')).toBe(15000);
        });
    });

    describe('calculateLineTotal', () => {
        it('calculates total correctly', () => {
            const items = [
                { quantity: 2, unit_price: 500 }, // 10.00 birr
                { quantity: 3, unit_price: 250 }, // 7.50 birr
            ];
            expect(calculateLineTotal(items)).toBe(1750); // 17.50 birr
        });

        it('handles empty array', () => {
            expect(calculateLineTotal([])).toBe(0);
        });
    });

    describe('calculateChange', () => {
        it('calculates change correctly', () => {
            expect(calculateChange(2000, 1550)).toBe(450);
            expect(calculateChange(1550, 2000)).toBe(0); // negative change
            expect(calculateChange(1550, 1550)).toBe(0);
        });
    });

    describe('isPaymentSufficient', () => {
        it('validates payment correctly', () => {
            expect(isPaymentSufficient(2000, 1550)).toBe(true);
            expect(isPaymentSufficient(1550, 2000)).toBe(false);
            expect(isPaymentSufficient(1550, 1550)).toBe(true);
        });
    });

    describe('SANTIM_PER_BIRR', () => {
        it('is 100', () => {
            expect(SANTIM_PER_BIRR).toBe(100);
        });
    });
});
