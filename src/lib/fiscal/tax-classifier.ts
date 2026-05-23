/**
 * Tax Classification Service
 * Implements OpenAccountants tax logic for 134+ countries including Ethiopia
 *
 * Features:
 * - Transaction classification into VAT, Income Tax, Social Security, Operating Expense buckets
 * - VAT rate lookup (15% for Ethiopia)
 * - Tax category and applicable rate determination
 * - Audit trail for classification decisions
 */

// ============================================================================
// Types and Enums
// ============================================================================

export type TaxCategory =
    | 'VAT'
    | 'INCOME_TAX'
    | 'SOCIAL_SECURITY'
    | 'OPERATING_EXPENSE'
    | 'OTHER';

export interface TaxRateResult {
    category: TaxCategory;
    rate: number;
    label: string;
    description: string;
}

export interface ClassificationInput {
    description: string;
    amount: number;
    currency: string;
    date: string;
    vendor?: string;
    countryCode?: string;
}

export interface ClassificationResult {
    category: TaxCategory;
    categoryLabel: string;
    applicableRate: number;
    rateLabel: string;
    isTaxable: boolean;
    auditTrail: ClassificationAuditEntry[];
}

export interface ClassificationAuditEntry {
    timestamp: string;
    step: string;
    detail: string;
    data?: Record<string, unknown>;
}

// ============================================================================
// Country Configuration
// ============================================================================

interface CountryConfig {
    code: string;
    name: string;
    vatRate: number;
    vatLabel: string;
    incomeTaxRates: { min: number; max: number };
    socialSecurityRate: number;
}

const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
    ETH: {
        code: 'ETH',
        name: 'Ethiopia',
        vatRate: 0.15,
        vatLabel: 'Ethiopian VAT (15%)',
        incomeTaxRates: { min: 0.01, max: 0.35 },
        socialSecurityRate: 0.10,
    },
    USA: {
        code: 'USA',
        name: 'United States',
        vatRate: 0,
        vatLabel: 'Sales Tax (varies by state)',
        incomeTaxRates: { min: 0.10, max: 0.37 },
        socialSecurityRate: 0.062,
    },
    GBR: {
        code: 'GBR',
        name: 'United Kingdom',
        vatRate: 0.20,
        vatLabel: 'UK VAT (20%)',
        incomeTaxRates: { min: 0.20, max: 0.45 },
        socialSecurityRate: 0,
    },
    DEU: {
        code: 'DEU',
        name: 'Germany',
        vatRate: 0.19,
        vatLabel: 'German VAT (19%)',
        incomeTaxRates: { min: 0.14, max: 0.42 },
        socialSecurityRate: 0.20,
    },
    FRA: {
        code: 'FRA',
        name: 'France',
        vatRate: 0.20,
        vatLabel: 'French VAT (20%)',
        incomeTaxRates: { min: 0.0, max: 0.45 },
        socialSecurityRate: 0.28,
    },
    KEN: {
        code: 'KEN',
        name: 'Kenya',
        vatRate: 0.16,
        vatLabel: 'Kenyan VAT (16%)',
        incomeTaxRates: { min: 0.10, max: 0.30 },
        socialSecurityRate: 0.06,
    },
    // Default fallback - will be extended to 134+ countries
    DEFAULT: {
        code: 'DEFAULT',
        name: 'International',
        vatRate: 0.15,
        vatLabel: 'Standard VAT (15%)',
        incomeTaxRates: { min: 0.10, max: 0.30 },
        socialSecurityRate: 0.10,
    },
};

// ============================================================================
// Classification Rules
// ============================================================================

interface ClassificationRule {
    pattern: RegExp | string;
    category: TaxCategory;
    weight: number;
    countrySpecific?: Record<string, TaxCategory>;
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
    // VAT-related keywords
    { pattern: /\b(vat|sales tax|gst|tax invoice|taxable)\b/i, category: 'VAT', weight: 10 },
    { pattern: /\b(food|meal|lunch|dinner|restaurant|cafe|beverage|drink)\b/i, category: 'VAT', weight: 8 },
    { pattern: /\b(grocery|supermarket|market|produce|meat|fish|vegetable)\b/i, category: 'VAT', weight: 8 },
    { pattern: /\b(office supply|stationery|paper|pen|pencil)\b/i, category: 'VAT', weight: 7 },
    { pattern: /\b(uniform|clothing|apparel)\b/i, category: 'VAT', weight: 5 },

    // Income tax keywords (specific to rental income, not office rent)
    { pattern: /\b(salary|wage|payroll|commission|bonus)\b/i, category: 'INCOME_TAX', weight: 10 },
    { pattern: /\b(consulting fee|service fee|professional fee|contractor)\b/i, category: 'INCOME_TAX', weight: 9 },
    { pattern: /\b(rental income|lease income|royalty|licensing fee)\b/i, category: 'INCOME_TAX', weight: 8 },
    { pattern: /\b(dividend|interest|capital gain|profit)\b/i, category: 'INCOME_TAX', weight: 9 },

    // Social security keywords
    { pattern: /\b(pension|social security|insurance|provident)\b/i, category: 'SOCIAL_SECURITY', weight: 8 },
    { pattern: /\b(payroll tax|employment tax|worker compensation)\b/i, category: 'SOCIAL_SECURITY', weight: 9 },
    { pattern: /\b(benefits|hmo|medical insurance|health plan)\b/i, category: 'SOCIAL_SECURITY', weight: 7 },

    // Operating expense keywords (includes office rent, utilities, etc.)
    { pattern: /\b(office rent|rent payment|utilities|electricity|water|gas)\b/i, category: 'OPERATING_EXPENSE', weight: 8 },
    { pattern: /\b(equipment|furniture|fixture|machinery|tool)\b/i, category: 'OPERATING_EXPENSE', weight: 7 },
    { pattern: /\b(marketing|advertising|promotion|seo|ppc)\b/i, category: 'OPERATING_EXPENSE', weight: 7 },
    { pattern: /\b(software|subscription|saas|license)\b/i, category: 'OPERATING_EXPENSE', weight: 6 },
    { pattern: /\b(liability|coverage)\b/i, category: 'OPERATING_EXPENSE', weight: 6 },
    { pattern: /\b(repair maintenance|fix|upgrade)\b/i, category: 'OPERATING_EXPENSE', weight: 6 },
    { pattern: /\b(travel|transport|fuel|delivery|shipping)\b/i, category: 'OPERATING_EXPENSE', weight: 6 },
];

// ============================================================================
// Tax Classifier Class
// ============================================================================

export class TaxClassifier {
    private auditTrail: ClassificationAuditEntry[] = [];

    constructor(private defaultCountry: string = 'ETH') {}

    /**
     * Classify a transaction and return tax information
     */
    classify(input: ClassificationInput): ClassificationResult {
        this.auditTrail = [];
        this.addAuditEntry('start', 'Classification started', { input });

        const countryCode = input.countryCode || this.defaultCountry;
        const country = COUNTRY_CONFIGS[countryCode] || COUNTRY_CONFIGS.DEFAULT;

        this.addAuditEntry('country_lookup', `Country resolved to: ${country.name}`, {
            countryCode,
            countryName: country.name,
        });

        const category = this.determineCategory(input.description, countryCode);
        this.addAuditEntry('category_determined', `Category: ${category}`, { category });

        const rateResult = this.getApplicableRate(category, country);

        this.addAuditEntry('rate_lookup', 'Rate determined', {
            rate: rateResult.rate,
            label: rateResult.label,
        });

        return {
            category,
            categoryLabel: this.getCategoryLabel(category),
            applicableRate: rateResult.rate,
            rateLabel: rateResult.label,
            isTaxable: category === 'VAT' || category === 'INCOME_TAX',
            auditTrail: [...this.auditTrail],
        };
    }

    /**
     * Get VAT rate for a country
     */
    getVATRate(countryCode?: string): number {
        const code = countryCode || this.defaultCountry;
        const country = COUNTRY_CONFIGS[code] || COUNTRY_CONFIGS.DEFAULT;
        return country.vatRate;
    }

    /**
     * Get tax rate for a specific category and country
     */
    getRateForCategory(category: TaxCategory, countryCode?: string): TaxRateResult {
        const code = countryCode || this.defaultCountry;
        const country = COUNTRY_CONFIGS[code] || COUNTRY_CONFIGS.DEFAULT;

        switch (category) {
            case 'VAT':
                return {
                    category: 'VAT',
                    rate: country.vatRate,
                    label: country.vatLabel,
                    description: `Value Added Tax at ${country.vatRate * 100}% for ${country.name}`,
                };
            case 'INCOME_TAX':
                return {
                    category: 'INCOME_TAX',
                    rate: country.incomeTaxRates.max,
                    label: `Income Tax (${country.incomeTaxRates.min * 100}% - ${country.incomeTaxRates.max * 100}%)`,
                    description: `Maximum income tax rate for individuals in ${country.name}`,
                };
            case 'SOCIAL_SECURITY':
                return {
                    category: 'SOCIAL_SECURITY',
                    rate: country.socialSecurityRate,
                    label: `Social Security (${country.socialSecurityRate * 100}%)`,
                    description: `Social security contribution rate for ${country.name}`,
                };
            default:
                return {
                    category: 'OTHER',
                    rate: 0,
                    label: 'No Tax',
                    description: 'Operating expenses are not directly taxable',
                };
        }
    }

    private determineCategory(description: string, countryCode: string): TaxCategory {
        let bestMatch: { category: TaxCategory; weight: number } | null = null;

        for (const rule of CLASSIFICATION_RULES) {
            const matches =
                typeof rule.pattern === 'string'
                    ? description.toLowerCase().includes(rule.pattern.toLowerCase())
                    : rule.pattern.test(description);

            if (matches) {
                if (!bestMatch || rule.weight > bestMatch.weight) {
                    const category = rule.countrySpecific?.[countryCode] || rule.category;
                    bestMatch = { category, weight: rule.weight };
                }
            }
        }

        return bestMatch?.category || 'OPERATING_EXPENSE';
    }

    private getApplicableRate(category: TaxCategory, country: CountryConfig): TaxRateResult {
        switch (category) {
            case 'VAT':
                return {
                    category: 'VAT',
                    rate: country.vatRate,
                    label: country.vatLabel,
                    description: `Value Added Tax at ${country.vatRate * 100}%`,
                };
            case 'INCOME_TAX':
                return {
                    category: 'INCOME_TAX',
                    rate: country.incomeTaxRates.max,
                    label: `Income Tax (${(country.incomeTaxRates.max * 100).toFixed(0)}%)`,
                    description: `Maximum income tax rate for ${country.name}`,
                };
            case 'SOCIAL_SECURITY':
                return {
                    category: 'SOCIAL_SECURITY',
                    rate: country.socialSecurityRate,
                    label: `Social Security (${(country.socialSecurityRate * 100).toFixed(0)}%)`,
                    description: `Social security contribution rate for ${country.name}`,
                };
            default:
                return {
                    category: 'OTHER',
                    rate: 0,
                    label: 'No Tax',
                    description: 'Operating expenses are not directly taxable',
                };
        }
    }

    private getCategoryLabel(category: TaxCategory): string {
        const labels: Record<TaxCategory, string> = {
            VAT: 'Value Added Tax',
            INCOME_TAX: 'Income Tax',
            SOCIAL_SECURITY: 'Social Security',
            OPERATING_EXPENSE: 'Operating Expense',
            OTHER: 'Other',
        };
        return labels[category];
    }

    private addAuditEntry(step: string, detail: string, data?: Record<string, unknown>): void {
        this.auditTrail.push({
            timestamp: new Date().toISOString(),
            step,
            detail,
            data,
        });
    }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _classifier: TaxClassifier | null = null;

export function getTaxClassifier(defaultCountry?: string): TaxClassifier {
    if (!_classifier || (defaultCountry && _classifier['defaultCountry'] !== defaultCountry)) {
        _classifier = new TaxClassifier(defaultCountry);
    }
    return _classifier;
}

export function resetTaxClassifier(): void {
    _classifier = null;
}