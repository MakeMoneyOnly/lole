/**
 * Nutrient DWS API Client for Document Processing
 *
 * Provides fiscal document processing capabilities:
 * - HTML to PDF conversion for receipts
 * - PDF/A export for Ethiopian fiscal reporting compliance
 * - OCR for scanned document processing
 * - PII redaction for security
 * - Tenant isolation for multi-tenant processing
 */

import { tenantContext } from '@/lib/context/tenant-context';
import { AppError, InternalError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';

const NUTRIENT_API_KEY = process.env.NUTRIENT_API_KEY;
const NUTRIENT_API_BASE = 'https://api.nutrient.io/dws';

interface NutrientResponse {
    status: 'success' | 'error';
    output?: {
        url?: string;
        pages?: number;
        text?: string;
    };
    error?: {
        message: string;
        code: string;
    };
}

interface DocumentOptions {
    restaurantId?: string;
    requestId?: string;
    tags?: string[];
}

interface ConvertHtmlOptions extends DocumentOptions {
    html: string;
    filename?: string;
}

interface OcrOptions extends DocumentOptions {
    fileUrl: string;
    language?: string;
}

interface RedactOptions extends DocumentOptions {
    fileUrl: string;
    redactionType: 'pii' | 'custom';
    customPatterns?: string[];
}

interface PdfAOptions extends DocumentOptions {
    fileUrl: string;
    conformance?: 'pdf/a-1a' | 'pdf/a-1b' | 'pdf/a-2a' | 'pdf/a-2b' | 'pdf/a-3a' | 'pdf/a-3b';
}

class NutrientClient {
    private apiKey: string | undefined;
    private baseUrl: string;

    constructor() {
        this.apiKey = NUTRIENT_API_KEY;
        this.baseUrl = NUTRIENT_API_BASE;

        if (!this.apiKey) {
            logger.warn(
                'NUTRIENT_API_KEY not configured. Document processing will be unavailable.'
            );
        }
    }

    private getRestaurantContext(): string | undefined {
        return tenantContext.getRestaurantIdSafe();
    }

    private getTenantHeaders(): Record<string, string> {
        const context = tenantContext.getStore();
        return {
            'x-tenant-id': context?.restaurantId ?? 'system',
            'x-request-id': context?.requestId ?? crypto.randomUUID(),
        };
    }

    private async makeRequest(
        endpoint: string,
        body: Record<string, unknown>
    ): Promise<NutrientResponse> {
        if (!this.apiKey) {
            throw new AppError('INTERNAL_ERROR', 'Document processing service unavailable', 503, {
                reason: 'NUTRIENT_API_KEY not configured',
            });
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                ...this.getTenantHeaders(),
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new AppError(
                'INTERNAL_ERROR',
                `Document processing failed: ${response.statusText}`,
                response.status,
                { apiError: errorText }
            );
        }

        const data = await response.json();
        return data as NutrientResponse;
    }

    public async convertHtmlToPdf(options: ConvertHtmlOptions): Promise<string> {
        const restaurantId = options.restaurantId ?? this.getRestaurantContext();
        const filename = options.filename ?? 'receipt.pdf';

        logger.info('Converting HTML to PDF', {
            restaurantId,
            filename,
            requestId: options.requestId,
        });

        const payload = {
            html: options.html,
            output: {
                type: 'pdf',
                filename,
            },
            instructions: [
                {
                    operation: 'pdf',
                    output: {
                        type: 'pdf',
                    },
                },
            ],
        };

        const response = await this.makeRequest('/process', payload);

        if (response.status !== 'success' || !response.output?.url) {
            throw new Error(response.error?.message ?? 'Failed to convert HTML to PDF');
        }

        return response.output.url;
    }

    public async ocrScannedDocument(options: OcrOptions): Promise<string> {
        const restaurantId = options.restaurantId ?? this.getRestaurantContext();

        logger.info('Processing OCR on scanned document', {
            restaurantId,
            fileUrl: options.fileUrl,
            requestId: options.requestId,
        });

        const payload = {
            url: options.fileUrl,
            ocr: {
                language: options.language ?? 'eng',
                ocrMode: 'scan',
            },
            instructions: [
                {
                    operation: 'ocr',
                    language: options.language ?? 'eng',
                },
            ],
        };

        const response = await this.makeRequest('/process', payload);

        if (response.status !== 'success' || !response.output?.url) {
            throw new Error(response.error?.message ?? 'Failed to process OCR');
        }

        return response.output.url;
    }

    public async redactPII(options: RedactOptions): Promise<string> {
        const restaurantId = options.restaurantId ?? this.getRestaurantContext();

        logger.info('Redacting PII from document', {
            restaurantId,
            fileUrl: options.fileUrl,
            redactionType: options.redactionType,
            requestId: options.requestId,
        });

        const instructions: Array<Record<string, unknown>> = [];

        if (options.redactionType === 'pii') {
            instructions.push({
                operation: 'redact',
                strategy: 'auto',
                redactionType: 'pii',
            });
        } else if (options.redactionType === 'custom' && options.customPatterns) {
            instructions.push({
                operation: 'redact',
                strategy: 'custom',
                patterns: options.customPatterns,
            });
        }

        const payload = {
            url: options.fileUrl,
            instructions,
        };

        const response = await this.makeRequest('/process', payload);

        if (response.status !== 'success' || !response.output?.url) {
            throw new Error(response.error?.message ?? 'Failed to redact PII');
        }

        return response.output.url;
    }

    public async convertToPdfA(options: PdfAOptions): Promise<string> {
        const restaurantId = options.restaurantId ?? this.getRestaurantContext();

        logger.info('Converting to PDF/A for fiscal compliance', {
            restaurantId,
            fileUrl: options.fileUrl,
            conformance: options.conformance ?? 'pdf/a-2b',
            requestId: options.requestId,
        });

        const payload = {
            url: options.fileUrl,
            instructions: [
                {
                    operation: 'pdf/a',
                    conformance: options.conformance ?? 'pdf/a-2b',
                    output: {
                        type: 'pdf',
                    },
                },
            ],
        };

        const response = await this.makeRequest('/process', payload);

        if (response.status !== 'success' || !response.output?.url) {
            throw new Error(response.error?.message ?? 'Failed to convert to PDF/A');
        }

        return response.output.url;
    }

    public async processFiscalDocument(params: {
        html: string;
        restaurantId?: string;
        documentType: 'receipt' | 'invoice' | 'report';
        applyOcr: boolean;
        piiFields?: string[];
        conformance?: PdfAOptions['conformance'];
    }): Promise<{ pdfUrl: string; redactedUrl?: string }> {
        const restaurantId = params.restaurantId ?? this.getRestaurantContext();

        logger.info('Processing fiscal document', {
            restaurantId,
            documentType: params.documentType,
        });

        let pdfUrl = await this.convertHtmlToPdf({
            html: params.html,
            filename: `${params.documentType}-${restaurantId}-${Date.now()}.pdf`,
            restaurantId,
        });

        if (params.applyOcr) {
            pdfUrl = await this.ocrScannedDocument({
                fileUrl: pdfUrl,
                restaurantId,
            });
        }

        let redactedUrl: string | undefined;
        if (params.piiFields && params.piiFields.length > 0) {
            redactedUrl = await this.redactPII({
                fileUrl: pdfUrl,
                redactionType: 'custom',
                customPatterns: params.piiFields,
                restaurantId,
            });
        }

        const finalUrl = redactedUrl ?? pdfUrl;
        const pdfAUrl = await this.convertToPdfA({
            fileUrl: finalUrl,
            restaurantId,
            conformance: params.conformance,
        });

        return {
            pdfUrl: pdfAUrl,
            redactedUrl,
        };
    }

    public async healthCheck(): Promise<boolean> {
        try {
            await this.makeRequest('/health', {});
            return true;
        } catch (error) {
            logger.error('Nutrient API health check failed', { error });
            return false;
        }
    }
}

export const nutrientClient = new NutrientClient();

export class NutrientClientError extends InternalError {
    constructor(message: string, code?: string) {
        super(message, { code });
    }
}

export type { ConvertHtmlOptions, DocumentOptions, OcrOptions, PdfAOptions, RedactOptions };
