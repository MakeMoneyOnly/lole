import { describe, expect, it } from 'vitest';
import { formatETBCurrency, formatLocalizedDate } from '@/lib/format/et';

describe('ET formatting helpers', () => {
    it('formats ETB currency for English locale', () => {
        // The function uses en-ET locale which formats as "ETB 1,235" (rounded to 0 fraction digits)
        const output = formatETBCurrency(1234.5, { locale: 'en' });
        // Check that it contains ETB and a number (format varies by locale)
        expect(output).toContain('ETB');
        // The number should be rounded to 1235 (0 fraction digits)
        expect(output).toMatch(/1[,.]?235/);
    });

    it('formats ETB currency for Amharic locale', () => {
        const output = formatETBCurrency(1234.5, { locale: 'am' });
        expect(output.length).toBeGreaterThan(0);
    });

    it('formats date using locale', () => {
        const output = formatLocalizedDate('2026-02-20T12:00:00.000Z', 'en');
        expect(output.length).toBeGreaterThan(0);
    });
});
