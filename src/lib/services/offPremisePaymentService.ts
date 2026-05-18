/**
 * Off-Premise Payment Service
 *
 * Handles payment enforcement for off-premise orders (delivery/pickup).
 * Requires upfront digital payment via Chapa before order submission.
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const log = logger.child('OffPremisePayment');

/**
 * Generate a unique ID without external dependency
 */
function generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Payment providers configuration
const PAYMENT_PROVIDERS = {
    chapa: {
        name: 'Chapa',
        api_url: process.env.CHAPA_API_URL ?? 'https://api.chapa.co/v1',
        secret_key: process.env.CHAPA_SECRET_KEY,
        public_key: process.env.CHAPA_PUBLIC_KEY,
    },
} as const;

type PaymentProvider = keyof typeof PAYMENT_PROVIDERS;

export interface OffPremisePaymentRequest {
    orderId: string;
    restaurantId: string;
    amount: number;
    currency: string;
    customerEmail?: string;
    customerPhone: string;
    customerName: string;
    returnUrl: string;
    webhookUrl: string;
    metadata?: Record<string, unknown>;
}

export interface PaymentInitializationResult {
    success: boolean;
    paymentId?: string;
    checkoutUrl?: string;
    reference?: string;
    provider?: PaymentProvider;
    error?: string;
    qrCode?: string;
}

export interface PaymentVerificationResult {
    success: boolean;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    amount?: number;
    currency?: string;
    paidAt?: string;
    reference?: string;
    error?: string;
}

/**
 * Initialize payment for off-premise order
 */
export async function initializeOffPremisePayment(
    request: OffPremisePaymentRequest
): Promise<PaymentInitializationResult> {
    const supabase = await createClient();
    const paymentReference = `GEB-${Date.now()}-${generateId().slice(0, 8).toUpperCase()}`;

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
            restaurant_id: request.restaurantId,
            order_id: request.orderId,
            amount: request.amount,
            currency: request.currency ?? 'ETB',
            method: 'digital',
            provider: 'chapa',
            status: 'pending',
            tip_amount: 0,
            metadata: {
                reference: paymentReference,
                customer_phone: request.customerPhone,
                customer_name: request.customerName,
                customer_email: request.customerEmail,
                ...request.metadata,
            },
        })
        .select('id')
        .single();

    if (paymentError || !payment) {
        log.error('Failed to create payment record', paymentError);
        return { success: false, error: 'Failed to initialize payment' };
    }

    const chapaConfig = PAYMENT_PROVIDERS.chapa;

    if (chapaConfig.secret_key) {
        const result = await initializeChapaPayment({
            ...request,
            paymentId: payment.id,
            reference: paymentReference,
        });

        if (result.success) {
            await supabase
                .from('payments')
                .update({
                    provider_reference: result.reference,
                    metadata: {
                        reference: paymentReference,
                        provider: 'chapa',
                        checkout_url: result.checkoutUrl,
                    },
                })
                .eq('id', payment.id);

            return { ...result, paymentId: payment.id, provider: 'chapa' };
        }
    }

    // Mock for development
    log.warn('No payment provider configured, using mock payment');
    return {
        success: true,
        paymentId: payment.id,
        checkoutUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/mock/${paymentReference}`,
        reference: paymentReference,
        provider: 'chapa',
    };
}

/**
 * Initialize Chapa payment
 */
async function initializeChapaPayment(params: {
    orderId: string;
    restaurantId: string;
    amount: number;
    currency: string;
    customerEmail?: string;
    customerPhone: string;
    customerName: string;
    returnUrl: string;
    webhookUrl: string;
    paymentId: string;
    reference: string;
}): Promise<PaymentInitializationResult> {
    const chapaConfig = PAYMENT_PROVIDERS.chapa;

    try {
        const response = await fetch(`${chapaConfig.api_url}/transaction/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${chapaConfig.secret_key}`,
            },
            body: JSON.stringify({
                amount: params.amount,
                currency: params.currency ?? 'ETB',
                email: params.customerEmail ?? 'guest@lole.et',
                first_name: params.customerName.split(' ')[0] ?? 'Guest',
                last_name: params.customerName.split(' ').slice(1).join(' ') ?? '',
                phone_number: params.customerPhone,
                tx_ref: params.reference,
                callback_url: params.webhookUrl,
                return_url: params.returnUrl,
                customization: {
                    title: 'lole Order',
                    description: `Payment for order ${params.orderId}`,
                },
                meta: {
                    order_id: params.orderId,
                    restaurant_id: params.restaurantId,
                    payment_id: params.paymentId,
                },
            }),
        });

        const data = await response.json();

        if (!response.ok || data.status !== 'success') {
            throw new Error(data.message ?? 'Chapa initialization failed');
        }

        return { success: true, checkoutUrl: data.data.checkout_url, reference: params.reference };
    } catch (error) {
        log.error('Chapa payment initialization failed', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Payment initialization failed',
        };
    }
}

/**
 * Verify payment status
 */
export async function verifyOffPremisePayment(
    paymentId: string
): Promise<PaymentVerificationResult> {
    const supabase = await createClient();

    // HIGH-013: Explicit column selection
    const { data: payment, error } = await supabase
        .from('payments')
        .select(
            'id, restaurant_id, order_id, amount, currency, method, provider, status, provider_reference, tip_amount, metadata, captured_at, created_at'
        )
        .eq('id', paymentId)
        .maybeSingle();

    if (error || !payment) {
        return { success: false, status: 'failed', error: 'Payment not found' };
    }

    if (payment.status === 'completed') {
        return {
            success: true,
            status: 'completed',
            amount: payment.amount,
            currency: payment.currency,
            paidAt: payment.captured_at ?? undefined,
            reference: payment.provider_reference ?? undefined,
        };
    }

    const provider = payment.provider as PaymentProvider;
    const metadata = payment.metadata as Record<string, unknown>;
    const reference = metadata?.reference as string;

    if (provider === 'chapa' && PAYMENT_PROVIDERS.chapa.secret_key) {
        return verifyChapaPayment(payment.id, reference);
    }

    return {
        success: true,
        status: payment.status as 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
        amount: payment.amount,
        currency: payment.currency,
        reference: reference,
    };
}

/**
 * Verify Chapa payment
 */
async function verifyChapaPayment(
    paymentId: string,
    reference: string
): Promise<PaymentVerificationResult> {
    const supabase = await createClient();
    const chapaConfig = PAYMENT_PROVIDERS.chapa;

    try {
        const response = await fetch(`${chapaConfig.api_url}/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${chapaConfig.secret_key}` },
        });

        const data = await response.json();

        if (!response.ok || data.status !== 'success') {
            return {
                success: false,
                status: 'failed',
                error: data.message ?? 'Verification failed',
            };
        }

        const txData = data.data;
        const status = mapChapaStatus(txData.status);

        await supabase
            .from('payments')
            .update({
                status,
                captured_at: status === 'completed' ? new Date().toISOString() : null,
                provider_reference: txData.reference ?? reference,
            })
            .eq('id', paymentId);

        return {
            success: status === 'completed',
            status,
            amount: txData.amount,
            currency: txData.currency ?? 'ETB',
            paidAt: txData.created_at ?? undefined,
            reference: txData.reference ?? reference,
        };
    } catch (error) {
        log.error('Chapa verification failed', error);
        return {
            success: false,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Verification failed',
        };
    }
}

function mapChapaStatus(
    status: string
): 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' {
    const map: Record<string, 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'> = {
        pending: 'pending',
        processing: 'processing',
        success: 'completed',
        failed: 'failed',
        cancelled: 'cancelled',
    };
    return map[status.toLowerCase()] ?? 'pending';
}

/**
 * Check if payment is required for off-premise order
 */
export function isPaymentRequiredForOffPremise(_fulfillmentType: 'delivery' | 'pickup'): boolean {
    return true; // Both delivery and pickup require upfront payment
}

/**
 * Calculate total with delivery fee
 */
export function calculateOffPremiseTotal(
    subtotal: number,
    deliveryFee: number,
    serviceFee: number = 0
): number {
    return subtotal + deliveryFee + serviceFee;
}
