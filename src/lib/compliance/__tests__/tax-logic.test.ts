import { describe, it, expect } from 'vitest';
import {
    TaxCategory,
    classifyTransaction,
    calculateTax,
    generateERCAReport,
    verifyClassification,
    EthiopiaTaxRates,
} from '../tax-logic';

describe('Tax Logic - Ethiopian Fiscal Reporting', () => {
    describe('TaxCategory enum', () => {
        it('should have all required tax categories', () => {
            expect(TaxCategory.VAT).toBe('VAT');
            expect(TaxCategory.INCOME_TAX).toBe('INCOME_TAX');
            expect(TaxCategory.WITHHOLDING_TAX).toBe('WITHHOLDING_TAX');
            expect(TaxCategory.SOCIAL_SECURITY).toBe('SOCIAL_SECURITY');
            expect(TaxCategory.OPERATING_EXPENSE).toBe('OPERATING_EXPENSE');
        });
    });

    describe('EthiopiaTaxRates', () => {
        it('should have VAT rate at 15%', () => {
            expect(EthiopiaTaxRates.VAT).toBe(0.15);
        });

        it('should have withholding tax rate defined', () => {
            expect(EthiopiaTaxRates.WITHHOLDING_TAX).toBeDefined();
            expect(EthiopiaTaxRates.WITHHOLDING_TAX).toBeGreaterThan(0);
        });

        it('should have social security rate defined', () => {
            expect(EthiopiaTaxRates.SOCIAL_SECURITY_EMPLOYER).toBeDefined();
            expect(EthiopiaTaxRates.SOCIAL_SECURITY_EMPLOYEE).toBeDefined();
        });
    });

    describe('classifyTransaction', () => {
        it('should classify VAT transaction from restaurant sales', () => {
            const transaction = {
                description: 'Restaurant food and beverage sales',
                amount: 1000,
                currency: 'ETB',
                date: '2026-05-15',
            };

            const result = classifyTransaction(transaction, 'ETHIOPIA');

            expect(result.category).toBe(TaxCategory.VAT);
            expect(result.confidence).toBeGreaterThan(0.5);
            expect(result.reasoning).toContain('VAT');
        });

        it('should classify operating expense for rent payment', () => {
            const transaction = {
                description: 'Monthly rent payment for business premises',
                amount: 50000,
                currency: 'ETB',
                date: '2026-05-01',
            };

            const result = classifyTransaction(transaction, 'ETHIOPIA');

            expect(result.category).toBe(TaxCategory.OPERATING_EXPENSE);
        });

        it('should classify withholding tax from supplier payment', () => {
            const transaction = {
                description: 'Supplier payment - withholding tax deducted',
                amount: 25000,
                currency: 'ETB',
                date: '2026-05-10',
            };

            const result = classifyTransaction(transaction, 'ETHIOPIA');

            expect(result.category).toBe(TaxCategory.WITHHOLDING_TAX);
        });

        it('should classify income tax for payroll', () => {
            const transaction = {
                description: 'Employee salary payment',
                amount: 30000,
                currency: 'ETB',
                date: '2026-05-30',
            };

            const result = classifyTransaction(transaction, 'ETHIOPIA');

            expect(result.category).toBe(TaxCategory.INCOME_TAX);
        });

        it('should include audit trail in classification result', () => {
            const transaction = {
                description: 'Restaurant sales',
                amount: 1000,
                currency: 'ETB',
                date: '2026-05-15',
            };

            const result = classifyTransaction(transaction, 'ETHIOPIA');

            expect(result.auditTrail).toBeDefined();
            expect(result.auditTrail).toHaveProperty('classifiedAt');
            expect(result.auditTrail).toHaveProperty('classifiedBy');
            expect(result.auditTrail.reason).toBeDefined();
        });
    });

    describe('calculateTax', () => {
        it('should calculate VAT for a given amount', () => {
            const result = calculateTax({
                category: TaxCategory.VAT,
                amount: 1000,
                country: 'ETHIOPIA',
            });

            expect(result.taxAmount).toBe(150);
            expect(result.rate).toBe(0.15);
        });

        it('should calculate withholding tax', () => {
            const result = calculateTax({
                category: TaxCategory.WITHHOLDING_TAX,
                amount: 10000,
                country: 'ETHIOPIA',
            });

            expect(result.taxAmount).toBe(500);
            expect(result.rate).toBe(0.05);
        });

        it('should return zero for operating expenses', () => {
            const result = calculateTax({
                category: TaxCategory.OPERATING_EXPENSE,
                amount: 5000,
                country: 'ETHIOPIA',
            });

            expect(result.taxAmount).toBe(0);
            expect(result.rate).toBe(0);
        });
    });

    describe('generateERCAReport', () => {
        it('should generate monthly VAT report', () => {
            const transactions = [
                {
                    description: 'Food sales',
                    amount: 50000,
                    currency: 'ETB',
                    date: '2026-05-15',
                },
                {
                    description: 'Beverage sales',
                    amount: 30000,
                    currency: 'ETB',
                    date: '2026-05-20',
                },
            ];

            const report = generateERCAReport({
                transactions,
                period: '2026-05',
                country: 'ETHIOPIA',
            });

            expect(report.period).toBe('2026-05');
            expect(report.currency).toBe('ETB');
            expect(report.totalVATAmount).toBe(12000);
            expect(report.taxLiabilities).toBeDefined();
        });

        it('should include ERCA classification codes', () => {
            const transactions = [
                {
                    description: 'Restaurant sales',
                    amount: 10000,
                    currency: 'ETB',
                    date: '2026-05-15',
                },
            ];

            const report = generateERCAReport({
                transactions,
                period: '2026-05',
                country: 'ETHIOPIA',
            });

            expect(report.ercaCodes).toBeDefined();
            expect(report.ercaCodes.VAT).toBe('VAT-001');
        });

        it('should handle withholding tax export', () => {
            const transactions = [
                {
                    description: 'Consulting service payment',
                    amount: 20000,
                    currency: 'ETB',
                    date: '2026-05-10',
                },
            ];

            const report = generateERCAReport({
                transactions,
                period: '2026-05',
                country: 'ETHIOPIA',
            });

            expect(report.withholdingTaxSummary).toBeDefined();
        });
    });

    describe('Multi-country support', () => {
        it('should throw error for unsupported country', () => {
            const transaction = {
                description: 'Test transaction',
                amount: 1000,
                currency: 'USD',
                date: '2026-05-15',
            };

            expect(() => classifyTransaction(transaction, 'MARS')).toThrow('Unsupported country');
        });
    });

    describe('Verification flag', () => {
        it('should mark high-value transactions for review', () => {
            const transaction = {
                description: 'Large supplier payment',
                amount: 500000,
                currency: 'ETB',
                date: '2026-05-15',
            };

            const result = classifyTransaction(transaction, 'ETHIOPIA');

            expect(result.requiresReview).toBe(true);
        });

        it('should not require review for low-value transactions', () => {
            const transaction = {
                description: 'Small purchase',
                amount: 500,
                currency: 'ETB',
                date: '2026-05-15',
            };

            const result = classifyTransaction(transaction, 'ETHIOPIA');

            expect(result.requiresReview).toBe(false);
        });
    });

    describe('verifyClassification', () => {
        it('should mark classification as reviewed by human', () => {
            const transaction = {
                description: 'Restaurant sales',
                amount: 10000,
                currency: 'ETB',
                date: '2026-05-15',
            };

            const classification = classifyTransaction(transaction, 'ETHIOPIA');
            const verified = verifyClassification({
                transaction,
                classification,
                reviewer: { id: 'acc-1', name: 'Abebe Kebede' },
            });

            expect(verified.auditTrail.classifiedBy).toBe('HUMAN');
            expect(verified.auditTrail.reviewedAt).toBeDefined();
            expect(verified.auditTrail.reviewedBy).toBe('Abebe Kebede');
            expect(verified.requiresReview).toBe(false);
        });
    });

    describe('Social Security classification', () => {
        it('should classify pension contribution as social security', () => {
            const transaction = {
                description: 'Pension fund contribution',
                amount: 5000,
                currency: 'ETB',
                date: '2026-05-15',
            };

            const result = classifyTransaction(transaction, 'ETHIOPIA');

            expect(result.category).toBe(TaxCategory.SOCIAL_SECURITY);
        });
    });

    describe('calculateTax error handling', () => {
        it('should throw error for unsupported country', () => {
            expect(() =>
                calculateTax({
                    category: TaxCategory.VAT,
                    amount: 1000,
                    country: 'MARS',
                })
            ).toThrow('Unsupported country');
        });

        it('should return zero rate for social security', () => {
            const result = calculateTax({
                category: TaxCategory.SOCIAL_SECURITY,
                amount: 5000,
                country: 'ETHIOPIA',
            });

            expect(result.rate).toBe(0);
            expect(result.taxAmount).toBe(0);
        });

        it('should return zero rate for income tax', () => {
            const result = calculateTax({
                category: TaxCategory.INCOME_TAX,
                amount: 5000,
                country: 'ETHIOPIA',
            });

            expect(result.rate).toBe(0);
        });
    });

    describe('generateERCAReport error handling', () => {
        it('should throw error for unsupported country', () => {
            const transactions = [
                {
                    description: 'Sales',
                    amount: 1000,
                    currency: 'ETB',
                    date: '2026-05-15',
                },
            ];

            expect(() =>
                generateERCAReport({
                    transactions,
                    period: '2026-05',
                    country: 'MARS',
                })
            ).toThrow('Unsupported country');
        });
    });

    describe('Default classification for unclassified transactions', () => {
        it('should classify unclassified transactions as operating expense', () => {
            const transaction = {
                description: 'Random transaction with no keywords',
                amount: 1000,
                currency: 'ETB',
                date: '2026-05-15',
            };

            const result = classifyTransaction(transaction, 'ETHIOPIA');

            expect(result.category).toBe(TaxCategory.OPERATING_EXPENSE);
            expect(result.reasoning).toContain('Default');
        });
    });
});
