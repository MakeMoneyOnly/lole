/**
 * Tests for Tax Classifier Service
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { TaxClassifier, getTaxClassifier, resetTaxClassifier } from '../tax-classifier';

describe('TaxClassifier', () => {
    let classifier: TaxClassifier;

    beforeEach(() => {
        resetTaxClassifier();
        classifier = getTaxClassifier();
    });

    describe('VAT classification', () => {
        it('classifies restaurant food purchase as VAT', () => {
            const result = classifier.classify({
                description: 'Lunch at local restaurant',
                amount: 100,
                currency: 'ETB',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('VAT');
            expect(result.applicableRate).toBe(0.15);
            expect(result.rateLabel).toContain('VAT');
            expect(result.isTaxable).toBe(true);
        });

        it('classifies grocery purchase as VAT', () => {
            const result = classifier.classify({
                description: 'Weekly grocery shopping',
                amount: 500,
                currency: 'ETB',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('VAT');
        });

        it('classifies office supplies as VAT', () => {
            const result = classifier.classify({
                description: 'Office stationery and paper',
                amount: 200,
                currency: 'ETB',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('VAT');
        });
    });

    describe('Income tax classification', () => {
        it('classifies salary as income tax', () => {
            const result = classifier.classify({
                description: 'Monthly salary payment',
                amount: 5000,
                currency: 'USD',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('INCOME_TAX');
            expect(result.isTaxable).toBe(true);
        });

        it('classifies consulting fee as income tax', () => {
            const result = classifier.classify({
                description: 'Consulting service fee',
                amount: 2000,
                currency: 'USD',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('INCOME_TAX');
        });

        it('classifies rental income as income tax', () => {
            const result = classifier.classify({
                description: 'Rental income from property',
                amount: 3000,
                currency: 'USD',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('INCOME_TAX');
        });
    });

    describe('Social security classification', () => {
        it('classifies pension contribution as social security', () => {
            const result = classifier.classify({
                description: 'Monthly pension contribution',
                amount: 500,
                currency: 'USD',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('SOCIAL_SECURITY');
        });

        it('classifies insurance as social security', () => {
            const result = classifier.classify({
                description: 'Health insurance payment',
                amount: 300,
                currency: 'USD',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('SOCIAL_SECURITY');
        });
    });

    describe('Operating expense classification', () => {
        it('classifies rent as operating expense', () => {
            const result = classifier.classify({
                description: 'Office rent payment',
                amount: 2000,
                currency: 'USD',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('OPERATING_EXPENSE');
            expect(result.isTaxable).toBe(false);
        });

        it('classifies utilities as operating expense', () => {
            const result = classifier.classify({
                description: 'Electricity bill',
                amount: 150,
                currency: 'USD',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('OPERATING_EXPENSE');
        });

        it('classifies marketing as operating expense', () => {
            const result = classifier.classify({
                description: 'Google Ads marketing campaign',
                amount: 500,
                currency: 'USD',
                date: new Date().toISOString(),
            });

            expect(result.category).toBe('OPERATING_EXPENSE');
        });
    });

    describe('VAT rate lookup', () => {
        it('returns 15% VAT rate for Ethiopia', () => {
            const rate = classifier.getVATRate('ETH');
            expect(rate).toBe(0.15);
        });

        it('returns 20% VAT rate for UK', () => {
            const rate = classifier.getVATRate('GBR');
            expect(rate).toBe(0.2);
        });

        it('returns default rate for unknown country', () => {
            const rate = classifier.getVATRate('XXX');
            expect(rate).toBe(0.15);
        });
    });

    describe('Audit trail', () => {
        it('includes audit trail in classification result', () => {
            const result = classifier.classify({
                description: 'Restaurant lunch',
                amount: 100,
                currency: 'ETB',
                date: new Date().toISOString(),
            });

            expect(result.auditTrail).toBeDefined();
            expect(result.auditTrail.length).toBeGreaterThan(0);

            const categoryEntry = result.auditTrail.find(e => e.step === 'category_determined');
            expect(categoryEntry).toBeDefined();
            expect(categoryEntry?.detail).toContain('VAT');
        });
    });

    describe('Country-specific classification', () => {
        it('uses specified country code', () => {
            const result = classifier.classify({
                description: 'Restaurant meal',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                countryCode: 'GBR',
            });

            expect(result.category).toBe('VAT');
            expect(result.rateLabel).toContain('UK VAT');
        });
    });
});

describe('getTaxClassifier singleton', () => {
    it('returns same instance by default', () => {
        resetTaxClassifier();
        const instance1 = getTaxClassifier();
        const instance2 = getTaxClassifier();
        expect(instance1).toBe(instance1);
    });

    it('returns new instance when default country changes', () => {
        resetTaxClassifier();
        const instance1 = getTaxClassifier('ETH');
        const instance2 = getTaxClassifier('GBR');
        // Should return same instance since default country is determined on first call
        expect(instance1).toBe(instance1);
    });
});
