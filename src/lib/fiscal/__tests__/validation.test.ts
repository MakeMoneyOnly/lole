import { describe, it, expect } from 'vitest';
import {
    validateTIN,
    validateVATNumber,
    validateTINDetailed,
    validateVATNumberDetailed,
} from '../validation';

describe('validateTIN', () => {
    it('accepts valid 10-digit TIN', () => {
        expect(validateTIN('1234567890')).toBe(true);
        expect(validateTIN('0012345678')).toBe(true);
    });

    it('rejects TIN with fewer than 10 digits', () => {
        expect(validateTIN('12345')).toBe(false);
        expect(validateTIN('123456789')).toBe(false);
    });

    it('rejects TIN with more than 10 digits', () => {
        expect(validateTIN('12345678901')).toBe(false);
    });

    it('rejects TIN with letters', () => {
        expect(validateTIN('ET12345678')).toBe(false);
    });

    it('rejects null/undefined/empty', () => {
        expect(validateTIN(null)).toBe(false);
        expect(validateTIN(undefined)).toBe(false);
        expect(validateTIN('')).toBe(false);
        expect(validateTIN('   ')).toBe(false);
    });

    it('trims whitespace', () => {
        expect(validateTIN('  1234567890  ')).toBe(true);
    });
});

describe('validateVATNumber', () => {
    it('accepts valid VAT number', () => {
        expect(validateVATNumber('VAT-ET-1234567890')).toBe(true);
        expect(validateVATNumber('VAT-ET-0012345678')).toBe(true);
        expect(validateVATNumber('vat-et-1234567890')).toBe(true);
    });

    it('rejects VAT without VAT-ET- prefix', () => {
        expect(validateVATNumber('1234567890')).toBe(false);
        expect(validateVATNumber('VAT-12345678')).toBe(false);
    });

    it('rejects VAT with non-numeric suffix', () => {
        expect(validateVATNumber('VAT-ET-ABC')).toBe(false);
    });

    it('rejects null/undefined/empty', () => {
        expect(validateVATNumber(null)).toBe(false);
        expect(validateVATNumber(undefined)).toBe(false);
        expect(validateVATNumber('')).toBe(false);
    });
});

describe('validateTINDetailed', () => {
    it('provides specific error for missing TIN', () => {
        const result = validateTINDetailed(null);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('MISSING');
    });

    it('provides specific error for short TIN', () => {
        const result = validateTINDetailed('123');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('TOO_SHORT');
    });

    it('provides specific error for non-numeric TIN', () => {
        const result = validateTINDetailed('ET12345678');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('NON_NUMERIC');
    });
});

describe('validateVATNumberDetailed', () => {
    it('provides specific error for missing VAT', () => {
        const result = validateVATNumberDetailed(null);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('MISSING');
    });

    it('provides specific error for wrong prefix', () => {
        const result = validateVATNumberDetailed('abc');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('INVALID_PREFIX');
    });

    it('provides specific error for short suffix', () => {
        const result = validateVATNumberDetailed('VAT-ET-123');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('INVALID_LENGTH');
    });
});
