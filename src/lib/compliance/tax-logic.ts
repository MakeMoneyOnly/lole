export enum TaxCategory {
    VAT = 'VAT',
    INCOME_TAX = 'INCOME_TAX',
    WITHHOLDING_TAX = 'WITHHOLDING_TAX',
    SOCIAL_SECURITY = 'SOCIAL_SECURITY',
    OPERATING_EXPENSE = 'OPERATING_EXPENSE',
}

export interface Transaction {
    description: string;
    amount: number;
    currency: string;
    date: string;
    vendorName?: string;
    categoryTags?: string[];
}

export interface ClassificationResult {
    category: TaxCategory;
    confidence: number;
    reasoning: string;
    auditTrail: AuditTrail;
    requiresReview: boolean;
}

export interface TaxCalculation {
    taxAmount: number;
    rate: number;
}

export interface AuditTrail {
    classifiedAt: string;
    classifiedBy: 'AI' | 'HUMAN';
    reason: string;
    reviewedAt?: string;
    reviewedBy?: string;
}

export interface ERCAReport {
    period: string;
    currency: string;
    totalVATAmount: number;
    taxLiabilities: Record<TaxCategory, number>;
    ercaCodes: {
        VAT: string;
        WITHHOLDING_TAX: string;
        INCOME_TAX: string;
    };
    withholdingTaxSummary?: {
        totalWithheld: number;
        transactions: number;
    };
}

export const EthiopiaTaxRates = {
    VAT: 0.15,
    WITHHOLDING_TAX: 0.05,
    SOCIAL_SECURITY_EMPLOYER: 0.1,
    SOCIAL_SECURITY_EMPLOYEE: 0.1,
} as const;

const SUPPORTED_COUNTRIES = new Set(['ETHIOPIA']);

const OPERATING_EXPENSE_KEYWORDS = [
    'rent',
    'lease',
    'utilities',
    'electricity',
    'water',
    'internet',
    'supplies',
    'equipment',
    'maintenance',
    'premises',
];

const VAT_KEYWORDS = ['sales', 'revenue', 'food', 'beverage', 'cafe', 'coffee', 'injera', 'meal'];

const WITHHOLDING_TAX_KEYWORDS = [
    'withholding',
    'supplier',
    'contractor',
    'consulting',
    'service payment',
];

const INCOME_TAX_KEYWORDS = ['salary', 'wage', 'payroll', 'employee', 'staff payment'];

const SOCIAL_SECURITY_KEYWORDS = ['pension', 'social security', 'pf', 'provident fund'];

const HIGH_VALUE_THRESHOLD = 100000;

export function classifyTransaction(
    transaction: Transaction,
    country: string
): ClassificationResult {
    if (!SUPPORTED_COUNTRIES.has(country)) {
        throw new Error(`Unsupported country: ${country}`);
    }

    const lowerDescription = transaction.description.toLowerCase();

    let category = TaxCategory.OPERATING_EXPENSE;
    let confidence = 0.5;
    let reasoning = 'Default classification as operating expense';

    for (const keyword of WITHHOLDING_TAX_KEYWORDS) {
        if (lowerDescription.includes(keyword)) {
            category = TaxCategory.WITHHOLDING_TAX;
            confidence = 0.8;
            reasoning = `Matched keyword '${keyword}' indicating withholding tax deduction`;
            break;
        }
    }

    for (const keyword of INCOME_TAX_KEYWORDS) {
        if (lowerDescription.includes(keyword)) {
            category = TaxCategory.INCOME_TAX;
            confidence = 0.75;
            reasoning = `Matched keyword '${keyword}' indicating income tax liability`;
            break;
        }
    }

    for (const keyword of VAT_KEYWORDS) {
        if (lowerDescription.includes(keyword)) {
            category = TaxCategory.VAT;
            confidence = 0.85;
            reasoning = `Matched keyword '${keyword}' indicating VAT taxable sales`;
            break;
        }
    }

    for (const keyword of OPERATING_EXPENSE_KEYWORDS) {
        if (lowerDescription.includes(keyword)) {
            category = TaxCategory.OPERATING_EXPENSE;
            confidence = 0.8;
            reasoning = `Matched keyword '${keyword}' indicating operating expense`;
            break;
        }
    }

    for (const keyword of SOCIAL_SECURITY_KEYWORDS) {
        if (lowerDescription.includes(keyword)) {
            category = TaxCategory.SOCIAL_SECURITY;
            confidence = 0.7;
            reasoning = `Matched keyword '${keyword}' indicating social security contribution`;
            break;
        }
    }

    const requiresReview = transaction.amount >= HIGH_VALUE_THRESHOLD;

    return {
        category,
        confidence,
        reasoning,
        auditTrail: {
            classifiedAt: new Date().toISOString(),
            classifiedBy: 'AI',
            reason: reasoning,
        },
        requiresReview,
    };
}

export function calculateTax(params: {
    category: TaxCategory;
    amount: number;
    country: string;
}): TaxCalculation {
    if (!SUPPORTED_COUNTRIES.has(params.country)) {
        throw new Error(`Unsupported country: ${params.country}`);
    }

    const rate = getTaxRate(params.category);
    const taxAmount = params.amount * rate;

    return { taxAmount, rate };
}

function getTaxRate(category: TaxCategory): number {
    switch (category) {
        case TaxCategory.VAT:
            return EthiopiaTaxRates.VAT;
        case TaxCategory.WITHHOLDING_TAX:
            return EthiopiaTaxRates.WITHHOLDING_TAX;
        case TaxCategory.INCOME_TAX:
            return 0;
        case TaxCategory.SOCIAL_SECURITY:
            return 0;
        case TaxCategory.OPERATING_EXPENSE:
            return 0;
        default:
            return 0;
    }
}

export function generateERCAReport(params: {
    transactions: Transaction[];
    period: string;
    country: string;
}): ERCAReport {
    if (!SUPPORTED_COUNTRIES.has(params.country)) {
        throw new Error(`Unsupported country: ${params.country}`);
    }

    const taxLiabilities: Record<TaxCategory, number> = {
        [TaxCategory.VAT]: 0,
        [TaxCategory.INCOME_TAX]: 0,
        [TaxCategory.WITHHOLDING_TAX]: 0,
        [TaxCategory.SOCIAL_SECURITY]: 0,
        [TaxCategory.OPERATING_EXPENSE]: 0,
    };

    let totalVATAmount = 0;
    let totalWithholdingTax = 0;
    let withholdingTaxCount = 0;

    for (const transaction of params.transactions) {
        const classification = classifyTransaction(transaction, params.country);
        const calculation = calculateTax({
            category: classification.category,
            amount: transaction.amount,
            country: params.country,
        });

        taxLiabilities[classification.category] += calculation.taxAmount;

        if (classification.category === TaxCategory.VAT) {
            totalVATAmount += calculation.taxAmount;
        }

        if (classification.category === TaxCategory.WITHHOLDING_TAX) {
            totalWithholdingTax += calculation.taxAmount;
            withholdingTaxCount++;
        }
    }

    return {
        period: params.period,
        currency: 'ETB',
        totalVATAmount,
        taxLiabilities,
        ercaCodes: {
            VAT: 'VAT-001',
            WITHHOLDING_TAX: 'WHT-001',
            INCOME_TAX: 'ITX-001',
        },
        withholdingTaxSummary: {
            totalWithheld: totalWithholdingTax,
            transactions: withholdingTaxCount,
        },
    };
}

export function verifyClassification(params: {
    transaction: Transaction;
    classification: ClassificationResult;
    reviewer: {
        id: string;
        name: string;
    };
}): ClassificationResult {
    return {
        ...params.classification,
        auditTrail: {
            ...params.classification.auditTrail,
            classifiedBy: 'HUMAN',
            reviewedAt: new Date().toISOString(),
            reviewedBy: params.reviewer.name,
        },
        requiresReview: false,
    };
}
