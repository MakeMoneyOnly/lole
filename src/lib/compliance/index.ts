/**
 * SEC-COMPLIANCE-001: Compliance Module
 *
 * Re-exports for document processing service
 */

export {
    DocumentProcessingService,
    getDocumentProcessingService,
    type TaxReceiptTemplate,
    type InvoiceTemplate,
    type PdfAOptions,
    type TextExtractionResult,
    type PIIOptions,
    type FiscalDocumentResult,
    type DocumentProcessor,
} from './document-processing';

/**
 * SEC-COMPLIANCE-002: OpenAccountants Tax Logic
 *
 * Re-exports for Ethiopian fiscal reporting
 */

export {
    TaxCategory,
    classifyTransaction,
    calculateTax,
    generateERCAReport,
    verifyClassification,
    EthiopiaTaxRates,
} from './tax-logic';

export type {
    Transaction,
    ClassificationResult,
    TaxCalculation,
    AuditTrail,
    ERCAReport,
} from './tax-logic';
