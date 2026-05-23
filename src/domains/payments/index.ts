/**
 * Payments domain exports
 * @module domains/payments
 */

// Repository
export { PaymentsRepository, paymentsRepository } from './repository';
export type { PaymentRow, PaymentStatus, PaymentProvider, PaymentListOptions } from './repository';

// Service
export { PaymentsService, paymentsService, PAYMENT_PROVIDERS, VALID_STATUSES } from './service';
export type { InitiatePaymentInput, PaymentResult } from './service';

// Resolvers
export { paymentsResolvers } from './resolvers';

// Tax Classification
export { taxClassifier } from './taxClassifier';
export type {
    TaxCategory,
    TaxClassification,
    TaxClassifierInput,
    MonthlyTaxExport,
    CountryTaxConfig,
} from './taxClassifier';
