/**
 * ERCA (Ethiopian Revenue and Customs Authority) Integration Service
 * MED-024: Production-ready ERCA fiscalization for Ethiopian VAT compliance
 *
 * Features:
 * - VAT calculation (15% for Ethiopia, tax-inclusive extraction)
 * - Receipt fiscalization with digital signature
 * - Transaction logging for audit trail
 * - Daily sales report generation
 * - Idempotent submission with retry logic
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { AppError, internalError, conflict, notFound } from '@/lib/api/errors';
import {
    signFiscalPayload,
    getLocalFiscalSigningConfig,
    type LocalFiscalSignatureEnvelope,
} from './local-signing';
import { validateTIN, validateVATNumber } from './validation';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * ERCA invoice payload structure
 * All monetary values are in santim (1 ETB = 100 santim)
 */
export interface ERCAInvoicePayload {
    invoice_number: string;
    tin: string;
    buyer_tin: string | null;
    issue_date: string; // ISO 8601, UTC
    currency: 'ETB';
    items: ERCALineItem[];
    subtotal_santim: number;
    vat_total_santim: number;
    grand_total_santim: number;
}

export interface ERCALineItem {
    description: string;
    description_am: string;
    quantity: number;
    unit_price_santim: number;
    vat_rate: 0.15;
    vat_amount_santim: number;
    line_total_santim: number;
}

/**
 * Result of ERCA invoice submission
 */
export interface ERCASubmissionResult {
    success: boolean;
    invoice_number: string;
    erca_invoice_id?: string;
    qr_payload?: string;
    digital_signature?: string;
    error?: string;
}

/**
 * Order data needed for ERCA submission
 */
export interface ERCAOrderData {
    id: string;
    order_number: string;
    restaurant_id: string;
    total_price: number;
    created_at: string;
    restaurant: {
        tin_number: string;
        vat_number: string | null;
        erca_enabled: boolean | null;
        name: string;
        name_am: string | null;
    };
    order_items: Array<{
        quantity: number;
        unit_price: number;
        menu_item: {
            name: string;
            name_am: string | null;
        };
    }>;
    guest?: {
        tin_number: string | null;
    } | null;
}

/**
 * VAT summary for daily reporting
 */
export interface VATSummary {
    date: string;
    invoice_count: number;
    total_revenue_etb: string;
    total_vat_etb: string;
    pending_count: number;
    failed_count: number;
}

/**
 * ERCA environment configuration
 */
export interface ERCAConfig {
    apiUrl: string;
    apiKey: string;
    sandboxMode: boolean;
    certificatePath?: string;
}

// ============================================================================
// Branded Types for Monetary Safety
// ============================================================================

/**
 * Branded type: amount in santim that includes VAT.
 * Ethiopian menus display tax-inclusive prices.
 */
export type TaxInclusiveSantim = number & { readonly __brand: 'TaxInclusiveSantim' };

/**
 * Branded type: amount in santim before VAT is added.
 */
export type NetSantim = number & { readonly __brand: 'NetSantim' };

export const asTaxInclusiveSantim = (value: number): TaxInclusiveSantim =>
    value as TaxInclusiveSantim;
export const asNetSantim = (value: number): NetSantim => value as NetSantim;

// ============================================================================
// Constants
// ============================================================================

/**
 * Ethiopian VAT rate (15%)
 */
export const VAT_RATE = 0.15;

/**
 * VAT rate as fraction for tax-inclusive extraction
 * For tax-inclusive prices: VAT = Price × (15/115)
 */
export const VAT_EXTRACTION_RATE = 15 / 115;

/**
 * Maximum retry attempts for ERCA submission
 */
export const MAX_RETRY_ATTEMPTS = 5;

/**
 * Retention period for ERCA records (7 years as per Ethiopian law)
 */
export const RETENTION_YEARS = 7;

/**
 * Santim per ETB
 */
export const SANTIM_PER_ETB = 100;

/**
 * Ethiopian withholding tax rate (2% for B2B transactions)
 */
export const WITHHOLDING_TAX_RATE = 0.02;

// ============================================================================
// VAT Calculation Functions
// ============================================================================

/**
 * Extract VAT from a tax-inclusive price
 * Ethiopian VAT law requires tax-inclusive pricing
 *
 * @param taxInclusivePriceSantim - Price including VAT in santim
 * @returns Net price and VAT portion in santim
 */
export function extractVAT(taxInclusivePriceSantim: number): {
    netPriceSantim: NetSantim;
    vatPortionSantim: NetSantim;
    roundingDifferenceSantim: number;
} {
    const exactVat = (taxInclusivePriceSantim * VAT_RATE) / (1 + VAT_RATE);
    const vatPortionSantim = Math.round(exactVat);
    const netPriceSantim = taxInclusivePriceSantim - vatPortionSantim;
    const roundingDifferenceSantim = Math.round(exactVat) - exactVat;
    return {
        netPriceSantim: asNetSantim(netPriceSantim),
        vatPortionSantim: asNetSantim(vatPortionSantim),
        roundingDifferenceSantim: Math.round(roundingDifferenceSantim * 100) / 100,
    };
}

export function calculateVAT(netPriceSantim: number): NetSantim {
    return asNetSantim(Math.round(netPriceSantim * VAT_RATE));
}

/**
 * Convert ETB to santim
 */
export function etbToSantim(etb: number): number {
    return Math.round(etb * SANTIM_PER_ETB);
}

/**
 * Convert santim to ETB
 */
export function santimToEtb(santim: number): number {
    return santim / SANTIM_PER_ETB;
}

/**
 * Generate unique invoice number for ERCA
 * Format: {restaurant_prefix}-{order_number}
 */
export function generateInvoiceNumber(restaurantId: string, orderNumber: string): string {
    const prefix = restaurantId.slice(0, 8).toUpperCase();
    return `${prefix}-${orderNumber}`;
}

// ============================================================================
// ERCA Service Class
// ============================================================================

/**
 * ERCA Integration Service
 * Handles invoice submission, retry logic, and audit logging
 */
export class ERCAService {
    private readonly config: ERCAConfig;
    private readonly supabase: SupabaseClient;

    constructor(config?: Partial<ERCAConfig>) {
        this.config = {
            apiUrl: config?.apiUrl ?? process.env.ERCA_API_URL ?? '',
            apiKey: config?.apiKey ?? process.env.ERCA_API_KEY ?? '',
            sandboxMode: config?.sandboxMode ?? process.env.ERCA_SANDBOX_MODE === 'true',
            certificatePath: config?.certificatePath ?? process.env.ERCA_CERTIFICATE_PATH,
        };

        this.supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
    }

    /**
     * Get the VAT rate for a restaurant.
     * Fetches from restaurant_settings.fiscal_config, falls back to 15%.
     */
    async getVATRate(restaurantId: string): Promise<number> {
        const { data, error } = await this.supabase
            .from('restaurant_settings')
            .select('fiscal_config')
            .eq('restaurant_id', restaurantId)
            .single();

        if (error || !data?.fiscal_config) {
            return VAT_RATE;
        }

        const config = data.fiscal_config as Record<string, unknown>;
        if (typeof config.vat_rate === 'number' && config.vat_rate > 0 && config.vat_rate < 1) {
            return config.vat_rate;
        }

        return VAT_RATE;
    }

    /**
     * Check if ERCA integration is enabled for a restaurant
     */
    async isERCAEnabled(restaurantId: string): Promise<boolean> {
        const { data, error } = await this.supabase
            .from('restaurants')
            .select('vat_number, erca_enabled')
            .eq('id', restaurantId)
            .single();

        if (error || !data) {
            return false;
        }

        return data.vat_number !== null && data.erca_enabled === true;
    }

    /**
     * Submit an invoice to ERCA
     *
     * @param orderId - The order ID to submit
     * @returns Submission result
     */
    async submitInvoice(orderId: string): Promise<ERCASubmissionResult> {
        // Fetch order with all needed relations
        const { data: order, error: orderError } = await this.supabase
            .from('orders')
            .select(
                `
                id,
                order_number,
                restaurant_id,
                total_price,
                created_at,
                restaurant:restaurants(
                    tin_number,
                    vat_number,
                    erca_enabled,
                    name,
                    name_am
                ),
                order_items(
                    quantity,
                    unit_price,
                    menu_item:menu_items(name, name_am)
                ),
                guest:guests(tin_number)
            `
            )
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            throw notFound('Order', orderId);
        }

        const orderData = order as unknown as ERCAOrderData;

        // Check if restaurant is VAT-registered and ERCA enabled
        if (!orderData.restaurant.vat_number || orderData.restaurant.erca_enabled !== true) {
            logger.info(
                'ERCA submission skipped - restaurant not VAT registered or ERCA disabled',
                {
                    orderId,
                    restaurantId: orderData.restaurant_id,
                }
            );
            return {
                success: true,
                invoice_number: generateInvoiceNumber(
                    orderData.restaurant_id,
                    orderData.order_number
                ),
                error: 'Restaurant not VAT registered or ERCA disabled',
            };
        }

        // Validate TIN and VAT number before submission
        if (!validateTIN(orderData.restaurant.tin_number)) {
            throw new AppError(
                'VALIDATION_ERROR',
                `Invalid TIN for restaurant ${orderData.restaurant_id}: "${orderData.restaurant.tin_number}"`,
                400,
                { restaurantId: orderData.restaurant_id }
            );
        }

        if (!validateVATNumber(orderData.restaurant.vat_number)) {
            throw new AppError(
                'VALIDATION_ERROR',
                `Invalid VAT number for restaurant ${orderData.restaurant_id}: "${orderData.restaurant.vat_number}"`,
                400,
                { restaurantId: orderData.restaurant_id }
            );
        }

        // Check for duplicate submission (idempotency)
        const { data: existing } = await this.supabase
            .from('erca_submissions')
            .select('id, invoice_number, erca_invoice_id, status')
            .eq('order_id', orderId)
            .single();

        if (existing) {
            // Already successfully submitted — return existing result
            if (existing.status === 'success') {
                logger.info('ERCA submission already exists', { orderId, existingId: existing.id });
                return {
                    success: true,
                    invoice_number: existing.invoice_number,
                    erca_invoice_id: existing.erca_invoice_id ?? undefined,
                };
            }

            // Previously stubbed — retry if API is now available
            if (
                existing.status === 'pending_fiscalization' &&
                this.config.apiUrl &&
                this.config.apiKey
            ) {
                logger.info('Retrying previously stubbed ERCA submission', {
                    orderId,
                    existingId: existing.id,
                });
            } else {
                logger.info('ERCA submission previously stubbed, API still unavailable', {
                    orderId,
                });
                return {
                    success: true,
                    invoice_number: existing.invoice_number,
                    qr_payload: `stub:${orderData.restaurant.tin_number}:${generateInvoiceNumber(orderData.restaurant_id, orderData.order_number)}`,
                    digital_signature: `stub-signature-${generateInvoiceNumber(orderData.restaurant_id, orderData.order_number)}`,
                    error: 'Previously stubbed — ERCA API not configured',
                };
            }
        }

        // Build payload
        const { payload, totalRoundingDifference } = this.buildPayload(orderData);

        // Calculate withholding tax (2% for B2B transactions)
        const isBusinessToBusiness = orderData.guest?.tin_number != null;
        const withholdingTaxSantim = isBusinessToBusiness
            ? Math.round(payload.grand_total_santim * WITHHOLDING_TAX_RATE)
            : 0;

        // Check if API is configured
        if (!this.config.apiUrl || !this.config.apiKey) {
            logger.warn('ERCA API not configured, using stub mode', { orderId });
            return this.recordStubSubmission(
                orderId,
                orderData.restaurant_id,
                payload,
                withholdingTaxSantim,
                totalRoundingDifference
            );
        }

        // Submit to ERCA
        try {
            const result = await this.submitToERCA(
                orderId,
                orderData.restaurant_id,
                payload,
                withholdingTaxSantim,
                totalRoundingDifference
            );
            return result;
        } catch (error) {
            logger.error('ERCA submission failed', {
                orderId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    /**
     * Build ERCA invoice payload from order data
     */
    private buildPayload(order: ERCAOrderData): {
        payload: ERCAInvoicePayload;
        totalRoundingDifference: number;
    } {
        let totalRoundingDifference = 0;

        const items: ERCALineItem[] = order.order_items.map(item => {
            const unitPriceSantim = etbToSantim(item.unit_price);
            const { netPriceSantim, vatPortionSantim, roundingDifferenceSantim } =
                extractVAT(unitPriceSantim);

            totalRoundingDifference += roundingDifferenceSantim * item.quantity;

            return {
                description: item.menu_item.name,
                description_am: item.menu_item.name_am ?? item.menu_item.name,
                quantity: item.quantity,
                unit_price_santim: netPriceSantim,
                vat_rate: 0.15 as const,
                vat_amount_santim: vatPortionSantim * item.quantity,
                line_total_santim: netPriceSantim * item.quantity,
            };
        });

        const subtotalSantim = items.reduce((sum, item) => sum + item.line_total_santim, 0);
        const vatTotalSantim = items.reduce((sum, item) => sum + item.vat_amount_santim, 0);
        const grandTotalSantim = subtotalSantim + vatTotalSantim;

        return {
            payload: {
                invoice_number: generateInvoiceNumber(order.restaurant_id, order.order_number),
                tin: order.restaurant.tin_number,
                buyer_tin: order.guest?.tin_number ?? null,
                issue_date: new Date().toISOString(),
                currency: 'ETB',
                items,
                subtotal_santim: subtotalSantim,
                vat_total_santim: vatTotalSantim,
                grand_total_santim: grandTotalSantim,
            },
            totalRoundingDifference,
        };
    }

    /**
     * Submit to ERCA API with digital signing
     */
    private async submitToERCA(
        orderId: string,
        restaurantId: string,
        payload: ERCAInvoicePayload,
        withholdingTaxSantim: number = 0,
        roundingDifferenceSantim: number = 0
    ): Promise<ERCASubmissionResult> {
        const idempotencyKey = `lole-${orderId}-${randomUUID()}`;

        let signatureEnvelope: LocalFiscalSignatureEnvelope | null = null;
        let digitalSignature: string | null = null;
        let qrPayload: string | null = null;

        const signingConfig = getLocalFiscalSigningConfig();
        if (signingConfig) {
            const fiscalPayload = {
                restaurant_tin: payload.tin,
                transaction_number: payload.invoice_number,
                occurred_at: payload.issue_date,
                subtotal: payload.subtotal_santim,
                tax_total: payload.vat_total_santim,
                grand_total: payload.grand_total_santim,
                order_id: orderId,
                items: payload.items.map(item => ({
                    name: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price_santim,
                    tax_rate: item.vat_rate,
                    total: item.line_total_santim + item.vat_amount_santim,
                })),
            };
            signatureEnvelope = await signFiscalPayload(fiscalPayload, signingConfig);
            digitalSignature = signatureEnvelope.signature;
            qrPayload = `lole:${payload.tin}:${payload.invoice_number}:${signatureEnvelope.digest}`;
        }

        try {
            const headers: Record<string, string> = {
                Authorization: `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': idempotencyKey,
                'X-Sandbox-Mode': this.config.sandboxMode ? 'true' : 'false',
            };

            if (digitalSignature) {
                headers['X-Digital-Signature'] = digitalSignature;
                headers['X-Signature-Algorithm'] = signatureEnvelope!.algorithm;
                headers['X-Signature-Key-Id'] = signatureEnvelope!.keyId;
            }

            const response = await fetch(`${this.config.apiUrl}/invoices`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new AppError(
                    'INTERNAL_ERROR',
                    `ERCA API error ${response.status}: ${errorText}`,
                    500,
                    { status: response.status, body: errorText }
                );
            }

            const result = (await response.json()) as Record<string, unknown>;

            await this.supabase.from('erca_submissions').insert({
                order_id: orderId,
                restaurant_id: restaurantId,
                invoice_number: payload.invoice_number,
                vat_amount_santim: payload.vat_total_santim,
                grand_total_santim: payload.grand_total_santim,
                withholding_tax_santim: withholdingTaxSantim,
                rounding_difference_santim: roundingDifferenceSantim,
                erca_invoice_id: String(result.invoice_id ?? result.id ?? ''),
                qr_payload: qrPayload ?? (result.qr_payload ? String(result.qr_payload) : null),
                digital_signature:
                    digitalSignature ??
                    (result.digital_signature ? String(result.digital_signature) : null),
                status: 'success',
                submitted_at: new Date().toISOString(),
            });

            logger.info('ERCA submission successful', {
                orderId,
                invoiceNumber: payload.invoice_number,
                ercaInvoiceId: result.invoice_id,
                signed: !!signatureEnvelope,
            });

            return {
                success: true,
                invoice_number: payload.invoice_number,
                erca_invoice_id: String(result.invoice_id ?? result.id ?? ''),
                qr_payload:
                    qrPayload ?? (result.qr_payload ? String(result.qr_payload) : undefined),
                digital_signature:
                    digitalSignature ??
                    (result.digital_signature ? String(result.digital_signature) : undefined),
            };
        } catch (error) {
            await this.supabase.from('erca_submissions').insert({
                order_id: orderId,
                restaurant_id: restaurantId,
                invoice_number: payload.invoice_number,
                vat_amount_santim: payload.vat_total_santim,
                grand_total_santim: payload.grand_total_santim,
                withholding_tax_santim: withholdingTaxSantim,
                rounding_difference_santim: roundingDifferenceSantim,
                digital_signature: digitalSignature,
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error',
            });

            throw error;
        }
    }

    /**
     * Record a stub submission when ERCA API is not configured
     */
    private async recordStubSubmission(
        orderId: string,
        restaurantId: string,
        payload: ERCAInvoicePayload,
        withholdingTaxSantim: number = 0,
        roundingDifferenceSantim: number = 0
    ): Promise<ERCASubmissionResult> {
        const stubSignature = `stub-signature-${payload.invoice_number}`;
        const stubQrPayload = `stub:${payload.tin}:${payload.invoice_number}:${santimToEtb(payload.grand_total_santim).toFixed(2)}`;

        await this.supabase.from('erca_submissions').upsert(
            {
                order_id: orderId,
                restaurant_id: restaurantId,
                invoice_number: payload.invoice_number,
                vat_amount_santim: payload.vat_total_santim,
                grand_total_santim: payload.grand_total_santim,
                withholding_tax_santim: withholdingTaxSantim,
                rounding_difference_santim: roundingDifferenceSantim,
                status: 'pending_fiscalization',
                qr_payload: stubQrPayload,
                digital_signature: stubSignature,
                submitted_at: new Date().toISOString(),
                error_message: 'Stub mode - ERCA API not configured',
            },
            { onConflict: 'order_id' }
        );

        return {
            success: true,
            invoice_number: payload.invoice_number,
            qr_payload: stubQrPayload,
            digital_signature: stubSignature,
        };
    }

    /**
     * Generate daily VAT summary for a restaurant
     */
    async generateDailyVATSummary(restaurantId: string, date: string): Promise<VATSummary> {
        const startOfDay = `${date}T00:00:00Z`;
        const endOfDay = `${date}T23:59:59Z`;

        const { data, error } = await this.supabase
            .from('erca_submissions')
            .select('grand_total_santim, vat_amount_santim, status')
            .eq('restaurant_id', restaurantId)
            .gte('submitted_at', startOfDay)
            .lte('submitted_at', endOfDay);

        if (error) {
            throw internalError('Failed to fetch VAT summary', error);
        }

        const submissions = data ?? [];
        const successful = submissions.filter(s => s.status === 'success');
        const pending = submissions.filter(s => s.status === 'pending');
        const failed = submissions.filter(s => s.status === 'failed');

        const totalRevenueSantim = successful.reduce(
            (sum, s) => sum + (s.grand_total_santim ?? 0),
            0
        );
        const totalVATSantim = successful.reduce((sum, s) => sum + (s.vat_amount_santim ?? 0), 0);

        return {
            date,
            invoice_count: successful.length,
            total_revenue_etb: santimToEtb(totalRevenueSantim).toFixed(2),
            total_vat_etb: santimToEtb(totalVATSantim).toFixed(2),
            pending_count: pending.length,
            failed_count: failed.length,
        };
    }

    /**
     * Get failed submissions for retry
     */
    async getFailedSubmissions(
        restaurantId: string,
        limit: number = 50
    ): Promise<
        Array<{
            id: string;
            order_id: string;
            invoice_number: string;
            error_message: string | null;
            created_at: string;
        }>
    > {
        const { data, error } = await this.supabase
            .from('erca_submissions')
            .select('id, order_id, invoice_number, error_message, created_at')
            .eq('restaurant_id', restaurantId)
            .eq('status', 'failed')
            .order('created_at', { ascending: true })
            .limit(limit);

        if (error) {
            throw internalError('Failed to fetch failed submissions', error);
        }

        return data ?? [];
    }

    /**
     * Retry a failed submission
     */
    async retrySubmission(submissionId: string): Promise<ERCASubmissionResult> {
        const { data: submission, error } = await this.supabase
            .from('erca_submissions')
            .select('order_id, retry_count')
            .eq('id', submissionId)
            .single();

        if (error || !submission) {
            throw notFound('ERCA Submission', submissionId);
        }

        // Check retry limit
        if ((submission.retry_count ?? 0) >= MAX_RETRY_ATTEMPTS) {
            throw conflict('Maximum retry attempts exceeded');
        }

        // Update retry count
        await this.supabase
            .from('erca_submissions')
            .update({
                status: 'retry',
                retry_count: (submission.retry_count ?? 0) + 1,
            })
            .eq('id', submissionId);

        // Re-submit
        return this.submitInvoice(submission.order_id);
    }

    /**
     * Generate monthly VAT report for accountant
     */
    async generateMonthlyVATReport(
        restaurantId: string,
        year: number,
        month: number
    ): Promise<{
        restaurant_id: string;
        period: { year: number; month: number };
        total_invoices: number;
        total_revenue_etb: string;
        total_vat_etb: string;
        daily_summaries: VATSummary[];
    }> {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const { data, error } = await this.supabase
            .from('erca_submissions')
            .select('grand_total_santim, vat_amount_santim, submitted_at, status')
            .eq('restaurant_id', restaurantId)
            .eq('status', 'success')
            .gte('submitted_at', `${startDateStr}T00:00:00Z`)
            .lte('submitted_at', `${endDateStr}T23:59:59Z`);

        if (error) {
            throw internalError('Failed to generate monthly report', error);
        }

        const submissions = data ?? [];
        const totalRevenueSantim = submissions.reduce(
            (sum, s) => sum + (s.grand_total_santim ?? 0),
            0
        );
        const totalVATSantim = submissions.reduce((sum, s) => sum + (s.vat_amount_santim ?? 0), 0);

        // Group by day
        const dailyMap = new Map<string, { revenue: number; vat: number; count: number }>();
        for (const submission of submissions) {
            const day = submission.submitted_at?.split('T')[0] ?? '';
            const existing = dailyMap.get(day) ?? { revenue: 0, vat: 0, count: 0 };
            dailyMap.set(day, {
                revenue: existing.revenue + (submission.grand_total_santim ?? 0),
                vat: existing.vat + (submission.vat_amount_santim ?? 0),
                count: existing.count + 1,
            });
        }

        const dailySummaries: VATSummary[] = Array.from(dailyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, data]) => ({
                date,
                invoice_count: data.count,
                total_revenue_etb: santimToEtb(data.revenue).toFixed(2),
                total_vat_etb: santimToEtb(data.vat).toFixed(2),
                pending_count: 0,
                failed_count: 0,
            }));

        return {
            restaurant_id: restaurantId,
            period: { year, month },
            total_invoices: submissions.length,
            total_revenue_etb: santimToEtb(totalRevenueSantim).toFixed(2),
            total_vat_etb: santimToEtb(totalVATSantim).toFixed(2),
            daily_summaries: dailySummaries,
        };
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

let _ercaService: ERCAService | null = null;

/**
 * Get the ERCA service singleton
 */
export function getERCAService(): ERCAService {
    if (!_ercaService) {
        _ercaService = new ERCAService();
    }
    return _ercaService;
}
