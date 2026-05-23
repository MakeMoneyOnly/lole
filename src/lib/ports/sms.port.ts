import type { AppError } from '../errors';

/**
 * Send SMS input DTO
 */
export interface SendSmsInput {
    to: string;
    body: string;
    mediaUrl?: string;
    from?: string;
    statusCallback?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Send SMS output DTO
 */
export interface SendSmsOutput {
    messageId: string;
    status: SmsStatus;
    delivered?: boolean;
    cost?: SmsCost;
}

/**
 * SMS delivery status
 */
export type SmsStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'undelivered';

/**
 * SMS cost information
 */
export interface SmsCost {
    amount: number;
    currency: string;
    pricePerUnit: number;
}

/**
 * SMS validation result
 */
export interface SmsValidationResult {
    valid: boolean;
    normalizedNumber?: string;
    error?: AppError;
}

/**
 * SMS Service Port
 * Defines the contract for SMS sending operations
 */
export interface SmsServicePort {
    /**
     * Send an SMS message
     * @param input - The SMS data
     * @returns The result containing message ID and status
     * @throws AppError on failure
     */
    sendSms(input: SendSmsInput): Promise<SendSmsOutput>;

    /**
     * Send an SMS from a template
     * @param templateId - The template identifier
     * @param to - Recipient phone number
     * @param variables - Template variables
     * @returns The result containing message ID and status
     * @throws AppError on failure
     */
    sendTemplateSms(
        templateId: string,
        to: string,
        variables: Record<string, unknown>
    ): Promise<SendSmsOutput>;

    /**
     * Get SMS delivery status
     * @param messageId - The message identifier
     * @returns Current delivery status
     * @throws AppError on failure
     */
    getSmsStatus(messageId: string): Promise<{ status: SmsStatus; deliveredAt?: Date }>;

    /**
     * Validate a phone number
     * @param phoneNumber - The phone number to validate
     * @returns Validation result
     */
    validatePhoneNumber(phoneNumber: string): Promise<SmsValidationResult>;
}
