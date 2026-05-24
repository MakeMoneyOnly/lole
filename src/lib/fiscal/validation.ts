/**
 * Ethiopian Tax Identifier Validation
 *
 * Validates Ethiopian Tax Identification Number (TIN) and
 * VAT Registration Number formats per Ministry of Revenue specifications.
 */

/**
 * Validate Ethiopian TIN (Tax Identification Number).
 *
 * Ethiopian TIN format:
 * - 10 numeric digits
 * - No letters or special characters
 * - Used for all tax-related identification
 *
 * @param tin - The TIN string to validate
 * @returns true if the TIN is valid
 */
export function validateTIN(tin: string | null | undefined): boolean {
    if (!tin) return false;

    const cleaned = tin.trim();

    // Ethiopian TIN: exactly 10 digits
    if (!/^\d{10}$/.test(cleaned)) {
        return false;
    }

    return true;
}

/**
 * Validate Ethiopian VAT Registration Number.
 *
 * Ethiopian VAT number format:
 * - Prefix: "VAT-ET-" (case-insensitive)
 * - Followed by numeric identifier (typically 8-10 digits)
 *
 * @param vat - The VAT number string to validate
 * @returns true if the VAT number is valid
 */
export function validateVATNumber(vat: string | null | undefined): boolean {
    if (!vat) return false;

    const cleaned = vat.trim().toUpperCase();

    // Check prefix and numeric suffix
    if (!/^VAT-ET-\d{6,12}$/.test(cleaned)) {
        return false;
    }

    return true;
}

/**
 * Reason codes for TIN validation failures
 */
export type TINValidationError =
    | 'MISSING'
    | 'TOO_SHORT'
    | 'TOO_LONG'
    | 'NON_NUMERIC'
    | 'INVALID_CHECK_DIGIT';

/**
 * Validate TIN with detailed error diagnostics.
 */
export function validateTINDetailed(tin: string | null | undefined): {
    valid: boolean;
    error?: TINValidationError;
    message?: string;
} {
    if (!tin || tin.trim() === '') {
        return { valid: false, error: 'MISSING', message: 'TIN is required for ERCA compliance' };
    }

    const cleaned = tin.trim();

    if (cleaned.length < 10) {
        return {
            valid: false,
            error: 'TOO_SHORT',
            message: `TIN must be 10 digits (got ${cleaned.length})`,
        };
    }

    if (cleaned.length > 10) {
        return {
            valid: false,
            error: 'TOO_LONG',
            message: `TIN must be 10 digits (got ${cleaned.length})`,
        };
    }

    if (!/^\d+$/.test(cleaned)) {
        return {
            valid: false,
            error: 'NON_NUMERIC',
            message: 'TIN must contain only digits',
        };
    }

    return { valid: true };
}

/**
 * Validate VAT number with detailed error diagnostics.
 */
export function validateVATNumberDetailed(vat: string | null | undefined): {
    valid: boolean;
    error?: string;
    message?: string;
} {
    if (!vat || vat.trim() === '') {
        return {
            valid: false,
            error: 'MISSING',
            message: 'VAT registration number is required for ERCA e-invoicing',
        };
    }

    const cleaned = vat.trim().toUpperCase();

    if (!cleaned.startsWith('VAT-ET-')) {
        return {
            valid: false,
            error: 'INVALID_PREFIX',
            message: 'VAT number must start with "VAT-ET-"',
        };
    }

    const numericPart = cleaned.slice(7);

    if (!/^\d+$/.test(numericPart)) {
        return {
            valid: false,
            error: 'NON_NUMERIC_SUFFIX',
            message: 'VAT number suffix must contain only digits',
        };
    }

    if (numericPart.length < 6 || numericPart.length > 12) {
        return {
            valid: false,
            error: 'INVALID_LENGTH',
            message: `VAT number suffix must be 6-12 digits (got ${numericPart.length})`,
        };
    }

    return { valid: true };
}
