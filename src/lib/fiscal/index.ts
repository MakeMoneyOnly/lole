/**
 * Fiscal Module Barrel Export
 * MED-024: ERCA integration and fiscal printer support
 */

// ERCA Service
export {
    ERCAService,
    getERCAService,
    extractVAT,
    calculateVAT,
    etbToSantim,
    santimToEtb,
    generateInvoiceNumber,
    asTaxInclusiveSantim,
    asNetSantim,
    VAT_RATE,
    VAT_EXTRACTION_RATE,
    SANTIM_PER_ETB,
    MAX_RETRY_ATTEMPTS,
    RETENTION_YEARS,
    WITHHOLDING_TAX_RATE,
    type TaxInclusiveSantim,
    type NetSantim,
    type ERCAInvoicePayload,
    type ERCALineItem,
    type ERCASubmissionResult,
    type ERCAOrderData,
    type VATSummary,
    type ERCAConfig,
} from './erca-service';

// MoR Fiscal Client
export {
    submitFiscalTransaction,
    isMorLiveConfigured,
    FiscalSubmissionError,
    type FiscalLineItem,
    type FiscalSubmissionRequest,
    type FiscalSubmissionResult,
} from './mor-client';

export {
    canonicalizeFiscalPayload,
    digestFiscalPayload,
    getLocalFiscalSigningConfig,
    signFiscalPayload,
    verifyFiscalPayloadSignature,
    type LocalFiscalSigningConfig,
    type LocalFiscalSigningPayload,
    type LocalFiscalSignatureEnvelope,
} from './local-signing';

// Offline Queue for fiscal submissions
export {
    queueFiscalJob,
    getPendingFiscalJobs,
    markFiscalJobSubmitted,
    markFiscalJobFailed,
    replayPendingFiscalJobs,
    type FiscalQueueJob,
    type FiscalQueueMode,
    type FiscalJobStatus,
} from './offline-queue';

// React hook for fiscal replay on network reconnect
export { useFiscalReplay } from './useFiscalReplay';

// Ethiopian tax identifier validation
export {
    validateTIN,
    validateVATNumber,
    validateTINDetailed,
    validateVATNumberDetailed,
    type TINValidationError,
} from './validation';
