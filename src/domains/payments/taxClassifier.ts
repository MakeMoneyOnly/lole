import { logger } from '@/lib/logger';

export type TaxCategory = 'VAT' | 'INCOME_TAX' | 'SOCIAL_SECURITY' | 'OPERATING_EXPENSE';

export interface TaxClassification {
    category: TaxCategory;
    taxRate: number;
    morCategory?: string;
    confidence: number;
    requiresVerification: boolean;
    reason: string;
}

export interface TaxClassifierInput {
    description: string;
    amount: number;
    currency: string;
    date: string;
    vendorName?: string;
    countryCode?: string;
    transactionType?: 'SALE' | 'EXPENSE' | 'REFUND';
}

export interface MonthlyTaxExport {
    restaurantId: string;
    year: number;
    month: number;
    classifications: Array<
        TaxClassification & {
            transactionId: string;
            amount: number;
            date: string;
            verifiedBy?: string;
            verificationDate?: string;
        }
    >;
    summary: {
        vat: { taxable: number; tax: number };
        incomeTax: { taxable: number };
        socialSecurity: { taxable: number; contributions: number };
        operatingExpense: { deductible: number };
    };
}

export interface CountryTaxConfig {
    countryCode: string;
    vatRate: number;
    vatAppliesToSales: boolean;
    withholdingTaxRate?: number;
    socialSecurityRate?: number;
    incomeTaxBrackets?: Array<{ min: number; max: number; rate: number }>;
    morMapping?: Record<string, string>;
}

class TaxClassifier {
    private countryConfigs: Map<string, CountryTaxConfig>;

    constructor() {
        this.countryConfigs = this.initializeCountryConfigs();
    }

    private initializeCountryConfigs(): Map<string, CountryTaxConfig> {
        const configs = new Map<string, CountryTaxConfig>();

        const ethiopia: CountryTaxConfig = {
            countryCode: 'ET',
            vatRate: 0.15,
            vatAppliesToSales: true,
            withholdingTaxRate: 0.03,
            socialSecurityRate: 0.1,
            morMapping: {
                '1001': 'Food & Beverage Sales',
                '1002': 'Beverage Sales',
                '2001': 'Food Cost',
                '2002': 'Beverage Cost',
                '2003': 'Labor Cost',
                '2004': 'Rent Expense',
                '2005': 'Utilities',
                '2006': 'Equipment Rental',
            },
        };
        configs.set('ET', ethiopia);

        const us: CountryTaxConfig = {
            countryCode: 'US',
            vatRate: 0,
            vatAppliesToSales: false,
            withholdingTaxRate: 0.0,
            socialSecurityRate: 0.062,
        };
        configs.set('US', us);

        const uk: CountryTaxConfig = {
            countryCode: 'GB',
            vatRate: 0.2,
            vatAppliesToSales: true,
            withholdingTaxRate: 0.0,
            socialSecurityRate: 0.0,
        };
        configs.set('GB', uk);

        const de: CountryTaxConfig = {
            countryCode: 'DE',
            vatRate: 0.19,
            vatAppliesToSales: true,
            withholdingTaxRate: 0.0,
            socialSecurityRate: 0.0,
        };
        configs.set('DE', de);

        const fr: CountryTaxConfig = {
            countryCode: 'FR',
            vatRate: 0.2,
            vatAppliesToSales: true,
            withholdingTaxRate: 0.0,
            socialSecurityRate: 0.0,
        };
        configs.set('FR', fr);

        const ae: CountryTaxConfig = {
            countryCode: 'AE',
            vatRate: 0.05,
            vatAppliesToSales: true,
            withholdingTaxRate: 0.0,
            socialSecurityRate: 0.0,
        };
        configs.set('AE', ae);

        const sa: CountryTaxConfig = {
            countryCode: 'SA',
            vatRate: 0.15,
            vatAppliesToSales: true,
            withholdingTaxRate: 0.0,
            socialSecurityRate: 0.0,
        };
        configs.set('SA', sa);

        return configs;
    }

    classifyTransaction(input: TaxClassifierInput): TaxClassification {
        const countryCode = input.countryCode || 'ET';
        const config = this.countryConfigs.get(countryCode) || this.countryConfigs.get('ET')!;

        const desc = input.description.toLowerCase();
        const isSale =
            input.transactionType === 'SALE' || (!input.transactionType && input.amount > 0);
        const isExpense = input.transactionType === 'EXPENSE' || input.amount < 0;

        if (isSale && config.vatRate > 0) {
            return {
                category: 'VAT',
                taxRate: config.vatRate,
                morCategory: config.morMapping?.['1001'],
                confidence: 0.95,
                requiresVerification: true,
                reason: `Sale transaction with ${countryCode} VAT rate`,
            };
        }

        if (isExpense || !isSale) {
            if (desc.includes('salary') || desc.includes('wage') || desc.includes('payroll')) {
                return {
                    category: 'SOCIAL_SECURITY',
                    taxRate: config.socialSecurityRate || 0.1,
                    morCategory: config.morMapping?.['2003'],
                    confidence: 0.9,
                    requiresVerification: true,
                    reason: 'Payroll/expense classified as Social Security contribution',
                };
            }

            if (desc.includes('food') || desc.includes('ingredient') || desc.includes('supply')) {
                return {
                    category: 'OPERATING_EXPENSE',
                    taxRate: 0,
                    morCategory: config.morMapping?.['2001'] || config.morMapping?.['2002'],
                    confidence: 0.85,
                    requiresVerification: true,
                    reason: 'Operating expense - cost of goods sold',
                };
            }

            if (desc.includes('rent') || desc.includes('lease')) {
                return {
                    category: 'OPERATING_EXPENSE',
                    taxRate: 0,
                    morCategory: config.morMapping?.['2004'],
                    confidence: 0.92,
                    requiresVerification: true,
                    reason: 'Rent expense',
                };
            }

            if (desc.includes('utility') || desc.includes('electric') || desc.includes('water')) {
                return {
                    category: 'OPERATING_EXPENSE',
                    taxRate: 0,
                    morCategory: config.morMapping?.['2005'],
                    confidence: 0.88,
                    requiresVerification: true,
                    reason: 'Utility expense',
                };
            }
        }

        return {
            category: 'OPERATING_EXPENSE',
            taxRate: 0,
            confidence: 0.5,
            requiresVerification: true,
            reason: 'Default classification - requires manual review',
        };
    }

    generateMonthlyExport(
        restaurantId: string,
        year: number,
        month: number,
        transactions: Array<TaxClassifierInput & { transactionId: string }>
    ): MonthlyTaxExport {
        const classifications = transactions.map(tx => {
            const classification = this.classifyTransaction(tx);
            return {
                ...classification,
                transactionId: tx.transactionId,
                amount: Math.abs(tx.amount),
                date: tx.date,
            };
        });

        const summary = {
            vat: {
                taxable: 0,
                tax: 0,
            },
            incomeTax: {
                taxable: 0,
            },
            socialSecurity: {
                taxable: 0,
                contributions: 0,
            },
            operatingExpense: {
                deductible: 0,
            },
        };

        for (const classification of classifications) {
            switch (classification.category) {
                case 'VAT':
                    summary.vat.taxable += classification.amount;
                    summary.vat.tax += classification.amount * classification.taxRate;
                    break;
                case 'INCOME_TAX':
                    summary.incomeTax.taxable += classification.amount;
                    break;
                case 'SOCIAL_SECURITY':
                    summary.socialSecurity.taxable += classification.amount;
                    summary.socialSecurity.contributions +=
                        classification.amount * classification.taxRate;
                    break;
                case 'OPERATING_EXPENSE':
                    summary.operatingExpense.deductible += classification.amount;
                    break;
            }
        }

        return {
            restaurantId,
            year,
            month,
            classifications,
            summary,
        };
    }

    verifyClassification(classification: TaxClassification, verifiedBy: string): TaxClassification {
        logger.info('Tax classification verified', {
            source: '[payments/taxClassifier]',
            verifiedBy,
            category: classification.category,
        });
        return {
            ...classification,
        };
    }

    getSupportedCountries(): string[] {
        return Array.from(this.countryConfigs.keys());
    }

    getCountryConfig(countryCode: string): CountryTaxConfig | undefined {
        return this.countryConfigs.get(countryCode);
    }
}

export const taxClassifier = new TaxClassifier();
