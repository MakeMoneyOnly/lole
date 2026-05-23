import type { AppError } from '../errors';

/**
 * Send email input DTO
 */
export interface SendEmailInput {
    to: string | string[];
    subject: string;
    htmlBody?: string;
    textBody?: string;
    cc?: string[];
    bcc?: string[];
    replyTo?: string;
    attachments?: EmailAttachment[];
    metadata?: Record<string, unknown>;
}

/**
 * Email attachment DTO
 */
export interface EmailAttachment {
    filename: string;
    contentType: string;
    content: Buffer | string;
    contentId?: string;
}

/**
 * Send email output DTO
 */
export interface SendEmailOutput {
    messageId: string;
    delivered: boolean;
}

/**
 * Email validation result
 */
export interface EmailValidationResult {
    valid: boolean;
    normalizedEmail?: string;
    error?: AppError;
}

/**
 * Email Service Port
 * Defines the contract for email sending operations
 */
export interface EmailServicePort {
    /**
     * Send an email
     * @param input - The email data
     * @returns The result containing message ID
     * @throws AppError on failure
     */
    sendEmail(input: SendEmailInput): Promise<SendEmailOutput>;

    /**
     * Send an email from a template
     * @param templateId - The template identifier
     * @param to - Recipient email address
     * @param variables - Template variables
     * @returns The result containing message ID
     * @throws AppError on failure
     */
    sendTemplateEmail(
        templateId: string,
        to: string,
        variables: Record<string, unknown>
    ): Promise<SendEmailOutput>;

    /**
     * Validate an email address
     * @param email - The email address to validate
     * @returns Validation result
     */
    validateEmail(email: string): Promise<EmailValidationResult>;
}
