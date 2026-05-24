/**
 * Receipt Templates for PDF/A-1a Fiscal Receipts
 * ERCA-compliant templates with Amharic/English bilingual support
 */

import type { LocalFiscalSignatureEnvelope } from '../local-signing';
import type { NutrientReceiptPayload } from '../nutrient-client';

// ============================================================================
// Receipt Template Interface
// ============================================================================

export interface ReceiptTemplate {
    render(
        payload: NutrientReceiptPayload,
        signature: LocalFiscalSignatureEnvelope,
        qrPayload: string
    ): string;
}

// ============================================================================
// Template Types
// ============================================================================

export interface TemplateContext {
    payload: NutrientReceiptPayload;
    signature: LocalFiscalSignatureEnvelope;
    qrPayload: string;
}

// ============================================================================
// Base Template Class
// ============================================================================

abstract class BaseTemplate implements ReceiptTemplate {
    protected readonly locale: 'en' | 'am' | 'both';

    constructor(locale: 'en' | 'am' | 'both' = 'both') {
        this.locale = locale;
    }

    abstract render(
        payload: NutrientReceiptPayload,
        signature: LocalFiscalSignatureEnvelope,
        qrPayload: string
    ): string;

    protected escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    protected formatSantim(santim: number): string {
        return (santim / 100).toFixed(2);
    }

    protected bilingual(en: string, am: string | null | undefined): string {
        if (this.locale === 'en') return en;
        if (this.locale === 'am') return am ?? en;
        return am ? `${en} / ${am}` : en;
    }
}

// ============================================================================
// Standard Receipt Template
// ============================================================================

export class StandardReceiptTemplate extends BaseTemplate {
    constructor(restaurantName?: string, locale: 'en' | 'am' | 'both' = 'both') {
        super(locale);
    }

    render(
        payload: NutrientReceiptPayload,
        signature: LocalFiscalSignatureEnvelope,
        qrPayload: string
    ): string {
        const isTaxInclusive = payload.tax_inclusive;

        return `<!DOCTYPE html>
<html lang="${this.locale === 'both' ? 'en' : this.locale}">
<head>
    <meta charset="UTF-8">
    <title>Fiscal Receipt - ${this.escapeHtml(payload.restaurant_name)}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body { 
            font-family: 'Noto Sans Ethiopic', 'Segoe UI', Arial, sans-serif; 
            font-size: 10pt; 
            line-height: 1.4; 
            color: #000;
            margin: 0;
            padding: 0;
        }
        .receipt { max-width: 600px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px; }
        .restaurant-name { font-size: 16pt; font-weight: bold; margin: 5px 0; }
        .restaurant-name-am { font-family: 'Noto Sans Ethiopic', sans-serif; font-size: 18pt; margin: 5px 0; }
        .receipt-title { font-size: 14pt; font-weight: bold; margin: 10px 0; }
        .meta { font-size: 9pt; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { text-align: left; padding: 4px 2px; }
        th { border-bottom: 1px solid #000; font-weight: bold; }
        .items td { border-bottom: 1px dotted #666; }
        .totals { margin-top: 15px; }
        .totals td { padding: 3px 0; }
        .total-row { font-weight: bold; border-top: 1px solid #000; }
        .footer { margin-top: 20px; text-align: center; font-size: 8pt; border-top: 1px solid #000; padding-top: 10px; }
        .qr-section { text-align: center; margin: 15px 0; }
        .qr-code { background: #000; padding: 10px; display: inline-block; margin: 10px 0; }
        .vat-note { font-size: 8pt; color: #333; margin-top: 5px; }
        .bilingual { font-family: 'Noto Sans Ethiopic', 'Segoe UI', Arial, sans-serif; }
    </style>
</head>
<body>
    <div class="receipt">
        <div class="header">
            <div class="restaurant-name-am">${this.escapeHtml(payload.restaurant_name_am ?? '')}</div>
            <div class="restaurant-name">${this.escapeHtml(payload.restaurant_name)}</div>
            <div class="meta">TIN: ${this.escapeHtml(payload.restaurant_tin)}</div>
            <div class="receipt-title">${this.bilingual('FISCAL RECEIPT', 'የደረጃ ደረጃ ደረጃ')}</div>
        </div>

        <div class="meta">
            <div><strong>${this.bilingual('Receipt #:', 'የደረጃ #:')}</strong> ${this.escapeHtml(payload.transaction_number)}</div>
            <div><strong>${this.bilingual('Date:', 'ቀን:')}</strong> ${new Date(payload.occurred_at).toISOString().split('T')[0]}</div>
            <div><strong>${this.bilingual('Time:', 'ሰዓት:')}</strong> ${new Date(payload.occurred_at).toTimeString().split(' ')[0]}</div>
            ${payload.buyer_tin ? `<div><strong>${this.bilingual('Customer TIN:', 'የደረጃ የምስክር መረጃ:')}</strong> ${this.escapeHtml(payload.buyer_tin)}</div>` : ''}
        </div>

        <table class="items">
            <thead>
                <tr>
                    <th>${this.bilingual('Item', 'እቃ')}</th>
                    <th style="text-align: center;">${this.bilingual('Qty', 'ብዛት')}</th>
                    <th style="text-align: right;">${this.bilingual('Amount', 'መጠን')}</th>
                </tr>
            </thead>
            <tbody>
                ${payload.items
                    .map(
                        item => `
                <tr>
                    <td>
                        <div>${this.escapeHtml(item.name_am ?? item.name)}</div>
                        ${item.name_am ? `<div class="bilingual">${this.escapeHtml(item.name)}</div>` : ''}
                    </td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">${this.formatSantim(item.total_santim)}</td>
                </tr>
                `
                    )
                    .join('')}
            </tbody>
        </table>

        <table class="totals">
            <tr>
                <td><strong>${this.bilingual('Subtotal:', 'ከፊል ድምረ Ṡ፣')}</strong></td>
                <td style="text-align: right;">${this.formatSantim(payload.subtotal_santim)} ETB</td>
            </tr>
            ${
                payload.tax_total_santim > 0
                    ? `
            <tr>
                <td><strong>${this.bilingual('VAT (15%):', 'የታወቁ ክፍል (15%):')}</strong></td>
                <td style="text-align: right;">${this.formatSantim(payload.tax_total_santim)} ETB</td>
            </tr>
            `
                    : ''
            }
            <tr class="total-row">
                <td><strong>${this.bilingual('TOTAL:', 'ጠቅላላ:')}</strong></td>
                <td style="text-align: right;"><strong>${this.formatSantim(payload.grand_total_santim)} ETB</strong></td>
            </tr>
        </table>

        ${isTaxInclusive ? `<div class="vat-note">${this.bilingual('Prices include VAT', 'በ VAT የተጨምሩ የተገቢዎች')}</div>` : `<div class="vat-note">${this.bilingual('VAT added to prices', 'በ VAT የተጠመቁ የተገቢዎች')}</div>`}

        <div class="qr-section">
            <div><strong>${this.bilingual('Verification QR Code', 'የማረጋገጥ QR ኮድ')}</strong></div>
            <div class="qr-code">
                <svg width="100" height="100" viewBox="0 0 100 100">
                    <rect width="100" height="100" fill="#000"/>
                    <rect x="10" y="10" width="20" height="20" fill="#fff"/>
                    <rect x="40" y="10" width="20" height="20" fill="#fff"/>
                    <rect x="70" y="10" width="20" height="20" fill="#fff"/>
                    <rect x="10" y="40" width="20" height="20" fill="#fff"/>
                    <rect x="70" y="40" width="20" height="20" fill="#fff"/>
                    <rect x="10" y="70" width="20" height="20" fill="#fff"/>
                    <rect x="40" y="70" width="20" height="20" fill="#fff"/>
                </svg>
            </div>
            <div style="font-size: 7pt; word-break: break-all;">${this.escapeHtml(qrPayload)}</div>
        </div>

        <div class="footer">
            <div><strong>${this.bilingual('Digital Signature:', 'የዲጃታዊ እርሳል:')}</strong></div>
            <div style="font-size: 7pt; word-break: break-all; margin: 5px 0;">${this.escapeHtml(signature.signature)}</div>
            <div style="margin-top: 10px; font-size: 7pt;">
                ${this.bilingual('This is an ERCA-compliant fiscal receipt.', 'ዓይነት ወይም ማረጋገጥ አዎንታል የመሆን ጊዜ')}
            </div>
            <div style="font-size: 7pt;">
                ${this.bilingual('Keep for your records.', 'ለመረጃዎ ይዞ ይቀበላል።')}
            </div>
        </div>
    </div>
</body>
</html>`;
    }
}

// ============================================================================
// Compact Receipt Template (for smaller receipts)
// ============================================================================

export class CompactReceiptTemplate extends BaseTemplate {
    render(
        payload: NutrientReceiptPayload,
        signature: LocalFiscalSignatureEnvelope,
        qrPayload: string
    ): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page { size: 80mm auto; margin: 5mm; }
        body { font-family: monospace; font-size: 8pt; line-height: 1.2; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 5px 0; }
        .items td { padding: 2px 0; }
    </style>
</head>
<body>
    <div class="center bold">${this.escapeHtml(payload.restaurant_name)}</div>
    <div class="center">${this.escapeHtml(payload.restaurant_tin)}</div>
    <div class="line"></div>
    <div>Receipt: ${this.escapeHtml(payload.transaction_number)}</div>
    <div>Date: ${new Date(payload.occurred_at).toISOString().split('T')[0]}</div>
    <div class="line"></div>
    <table class="items" width="100%">
        ${payload.items
            .map(
                item => `
        <tr>
            <td>${this.escapeHtml(item.name)}</td>
        </tr>
        <tr>
            <td><span class="right">${item.quantity} x ${this.formatSantim(item.unit_price_santim)}</span></td>
        </tr>
        `
            )
            .join('')}
    </table>
    <div class="line"></div>
    <div class="right bold">TOTAL: ${this.formatSantim(payload.grand_total_santim)} ETB</div>
    <div class="line"></div>
    <div class="center" style="font-size: 6pt;">${this.escapeHtml(qrPayload)}</div>
    <div class="center" style="font-size: 6pt;">Signed: ${this.escapeHtml(signature.signature.substring(0, 16))}...</div>
</body>
</html>`;
    }
}

// ============================================================================
// Template Factory
// ============================================================================

export const ReceiptTemplates = {
    create(restaurantName?: string, locale: 'en' | 'am' | 'both' = 'both'): ReceiptTemplate {
        return new StandardReceiptTemplate(locale);
    },

    createCompact(): ReceiptTemplate {
        return new CompactReceiptTemplate('en');
    },

    standard(locale: 'en' | 'am' | 'both' = 'both'): ReceiptTemplate {
        return new StandardReceiptTemplate(locale);
    },

    compact(): ReceiptTemplate {
        return new CompactReceiptTemplate('en');
    },
};
