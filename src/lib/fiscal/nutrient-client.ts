/**
 * Nutrient DWS Client for PDF/A-1a Fiscal Receipt Generation
 * MED-024: Compliant PDF generation for Ethiopian ERCA requirements
 */

import {
    signFiscalPayload,
    getLocalFiscalSigningConfig,
    type LocalFiscalSignatureEnvelope,
} from './local-signing';
import type { ReceiptTemplate } from './templates/receipt-template';

// ============================================================================
// Types
// ============================================================================

export interface NutrientReceiptItem {
    name: string;
    name_am?: string | null;
    quantity: number;
    unit_price_santim: number;
    vat_rate: number;
    vat_amount_santim: number;
    total_santim: number;
    item_code?: string | null;
}

export interface NutrientReceiptPayload {
    restaurant_tin: string;
    restaurant_name: string;
    restaurant_name_am?: string | null;
    transaction_number: string;
    occurred_at: string;
    items: NutrientReceiptItem[];
    subtotal_santim: number;
    tax_total_santim: number;
    grand_total_santim: number;
    order_id?: string | null;
    buyer_tin?: string | null;
    tax_inclusive: boolean;
    locale?: 'en' | 'am' | 'both';
}

export interface NutrientReceiptResult {
    pdfBytes: Uint8Array;
    qr_payload: string;
    digital_signature: string;
    signature_envelope: LocalFiscalSignatureEnvelope;
}

export interface NutrientClientConfig {
    apiKey: string;
    apiUrl?: string;
    pdfaLevel?: 'PDF/A-1a' | 'PDF/A-1b' | 'PDF/A-2a' | 'PDF/A-2b';
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_API_URL = 'https://api.nutrient.io/dws' as const;
const DEFAULT_PDFA_LEVEL = 'PDF/A-1a' as const;
const SANTIM_PER_ETB = 100;

// ============================================================================
// Client Class
// ============================================================================

export class NutrientClient {
    private readonly apiKey: string;
    private readonly apiUrl: string;
    private readonly pdfaLevel: string;

    constructor(config?: Partial<NutrientClientConfig>) {
        this.apiKey = config?.apiKey ?? process.env.NUTRIENT_API_KEY ?? '';
        this.apiUrl = config?.apiUrl ?? process.env.NUTRIENT_API_URL ?? DEFAULT_API_URL;
        this.pdfaLevel = config?.pdfaLevel ?? DEFAULT_PDFA_LEVEL;

        if (!this.apiKey) {
            throw new Error('NUTRIENT_API_KEY is required');
        }
    }

    /**
     * Generate PDF/A-1a compliant fiscal receipt
     */
    async generateFiscalReceipt(
        orderData: NutrientReceiptPayload,
        template?: ReceiptTemplate
    ): Promise<NutrientReceiptResult> {
        // Generate digital signature using existing local-signing
        const signatureEnvelope = await this.generateSignature(orderData);

        // Build QR payload for verification
        const qrPayload = this.buildQrPayload(orderData, signatureEnvelope);

        // Use provided template or default
        const html = template
            ? template.render(orderData, signatureEnvelope, qrPayload)
            : await this.buildDefaultTemplate(orderData, signatureEnvelope, qrPayload);

        // Convert HTML to PDF/A via Nutrient DWS
        const pdfBytes = await this.htmlToPdfA(html);

        return {
            pdfBytes,
            qr_payload: qrPayload,
            digital_signature: signatureEnvelope.signature,
            signature_envelope: signatureEnvelope,
        };
    }

    /**
     * Build QR payload for ERCA verification
     */
    private buildQrPayload(
        payload: NutrientReceiptPayload,
        envelope: LocalFiscalSignatureEnvelope
    ): string {
        return `lole:${payload.restaurant_tin}:${payload.transaction_number}:${envelope.digest}`;
    }

    /**
     * Generate digital signature using local-signing
     */
    private async generateSignature(
        payload: NutrientReceiptPayload
    ): Promise<LocalFiscalSignatureEnvelope> {
        const signingConfig = getLocalFiscalSigningConfig();

        if (!signingConfig) {
            throw new Error('Local fiscal signing not configured. Set LOCAL_FISCAL_SIGNING_SECRET');
        }

        const fiscalPayload = {
            restaurant_tin: payload.restaurant_tin,
            transaction_number: payload.transaction_number,
            occurred_at: payload.occurred_at,
            subtotal: payload.subtotal_santim,
            tax_total: payload.tax_total_santim,
            grand_total: payload.grand_total_santim,
            order_id: payload.order_id ?? null,
            items: payload.items.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unit_price: item.unit_price_santim,
                tax_rate: item.vat_rate,
                total: item.total_santim,
                item_code: item.item_code ?? null,
            })),
        };

        return await signFiscalPayload(fiscalPayload, signingConfig);
    }

    /**
     * Convert HTML to PDF/A-1a using Nutrient DWS
     */
    private async htmlToPdfA(html: string): Promise<Uint8Array> {
        const response = await fetch(`${this.apiUrl}/process`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                html,
                output: {
                    format: this.pdfaLevel,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Nutrient DWS error: ${response.status} ${errorText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }

    /**
     * Build default HTML template (bilingual English/Amharic)
     */
    private async buildDefaultTemplate(
        payload: NutrientReceiptPayload,
        envelope: LocalFiscalSignatureEnvelope,
        qrPayload: string
    ): Promise<string> {
        const { StandardReceiptTemplate } = await import('./templates/receipt-template');
        const template = new StandardReceiptTemplate(payload.locale ?? 'both');
        return template.render(payload, envelope, qrPayload);
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function santimToEtb(santim: number): number {
    return santim / SANTIM_PER_ETB;
}

export function formatCurrency(santim: number, locale: 'en' | 'am' = 'en'): string {
    const etb = santimToEtb(santim);
    return locale === 'am' ? `${etb.toFixed(2)} ብር` : `${etb.toFixed(2)} ETB`;
}

export function formatDateTime(isoDate: string, locale: 'en' | 'am' = 'en'): string {
    const date = new Date(isoDate);
    if (locale === 'am') {
        return date.toLocaleString('am-ET', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    return date.toLocaleString('en-ET', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// ============================================================================
// Bilingual Text Helper
// ============================================================================

export function bilingualText(
    en: string,
    am: string | null | undefined,
    locale: 'en' | 'am' | 'both' = 'both'
): string {
    if (locale === 'en') return en;
    if (locale === 'am') return am ?? en;
    return am ? `${en} / ${am}` : en;
}

// ============================================================================
// Factory Function
// ============================================================================

let _nutrientClient: NutrientClient | null = null;

export function getNutrientClient(config?: Partial<NutrientClientConfig>): NutrientClient {
    if (!_nutrientClient) {
        _nutrientClient = new NutrientClient(config);
    }
    return _nutrientClient;
}

export async function generateFiscalReceipt(
    orderData: NutrientReceiptPayload,
    template?: ReceiptTemplate
): Promise<NutrientReceiptResult> {
    const client = getNutrientClient();
    return client.generateFiscalReceipt(orderData, template);
}
