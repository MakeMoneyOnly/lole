/**
 * POST /api/jobs/payments/retry
 *
 * Job handler for payment retry logic.
 * Processes failed payments and attempts to retry/verify them.
 *
 * This is triggered via QStash when:
 * 1. A payment webhook indicates failure
 * 2. A manual retry is requested
 * 3. A scheduled retry check runs
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createPaymentLifecycleEvent } from '@/lib/events/contracts';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { verifyChapaTransaction } from '@/lib/services/chapaService';
import { processPaymentLifecycleEvent } from '@/lib/payments/payment-event-consumer';
import type { Json } from '@/types/database';

const PaymentRetryJobSchema = z.object({
    payment_session_id: z.string().uuid().optional(),
    order_id: z.string().uuid().optional(),
    provider: z.enum(['chapa']).default('chapa'),
    provider_transaction_id: z.string().optional(),
    retry_count: z.number().int().min(0).max(5).default(0),
    trigger: z.enum(['webhook_failed', 'manual', 'scheduled']).default('scheduled'),
});

function isAuthorized(request: NextRequest): boolean {
    const configuredKey = process.env.QSTASH_TOKEN;
    if (!configuredKey) {
        return process.env.NODE_ENV !== 'production';
    }
    return request.headers.get('x-lole-job-key') === configuredKey;
}

/**
 * Verify and process a Chapa payment
 */
async function verifyAndProcessChapaPayment(
    txRef: string,
    orderId: string | null,
    restaurantId: string
): Promise<{
    success: boolean;
    status: 'completed' | 'failed' | 'pending' | 'error';
    error?: string;
    data?: Record<string, unknown>;
}> {
    try {
        // Verify the transaction with Chapa
        const verificationResult = await verifyChapaTransaction(txRef);

        if (verificationResult.status !== 'success') {
            return {
                success: false,
                status: 'error',
                error: verificationResult.message || 'Verification failed',
            };
        }

        const data = verificationResult.data;
        const paymentStatus = data?.status === 'success' ? 'completed' : 'failed';

        // Create and process the payment lifecycle event
        const event = createPaymentLifecycleEvent(paymentStatus, {
            restaurant_id: restaurantId,
            order_id: orderId,
            payment_id: null,
            payment_session_id: null,
            provider: 'chapa',
            provider_transaction_id: txRef,
            idempotency_key: `retry-${txRef}-${Date.now()}`,
            status: paymentStatus,
            amount: data?.amount ? Math.round(parseFloat(data.amount) * 100) : null,
            currency: data?.currency || 'ETB',
            metadata: {
                retry: true,
                verified_at: new Date().toISOString(),
            },
            raw_payload: (data || {}) as Record<string, unknown>,
        });

        await processPaymentLifecycleEvent(event);

        return {
            success: true,
            status: paymentStatus,
            data,
        };
    } catch (error) {
        return {
            success: false,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * Check if payment session can be retried
 */
async function checkRetryEligibility(paymentSessionId: string): Promise<{
    eligible: boolean;
    reason?: string;
    txRef?: string;
    orderId?: string;
    restaurantId?: string;
    previousAttempts?: number;
}> {
    const admin = createServiceRoleClient();

    const { data: session, error } = await admin
        .from('payment_sessions')
        .select('id, order_id, restaurant_id, provider_reference, status, metadata')
        .eq('id', paymentSessionId)
        .maybeSingle();

    if (error || !session) {
        return { eligible: false, reason: 'Payment session not found' };
    }

    if (session.status === 'captured' || session.status === 'completed') {
        return { eligible: false, reason: 'Payment already completed' };
    }

    const previousAttempts =
        Number((session.metadata as Record<string, unknown>)?.retry_count) || 0;
    if (previousAttempts >= 5) {
        return { eligible: false, reason: 'Max retry attempts reached' };
    }

    return {
        eligible: true,
        txRef: session.provider_reference,
        orderId: session.order_id,
        restaurantId: session.restaurant_id,
        previousAttempts: previousAttempts as number,
    };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isAuthorized(request)) {
        return NextResponse.json(
            {
                error: {
                    code: 'UNAUTHORIZED_JOB',
                    message: 'Job request is not authorized',
                },
            },
            { status: 401 }
        );
    }

    const body = await request.json().catch(() => null);
    const parsed = PaymentRetryJobSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            {
                error: {
                    code: 'INVALID_JOB_PAYLOAD',
                    message: 'Invalid payment retry payload',
                    details: parsed.error.flatten(),
                },
            },
            { status: 400 }
        );
    }

    const {
        payment_session_id,
        order_id,
        provider,
        provider_transaction_id,
        retry_count,
        ..._rest
    } = parsed.data;
    let resolvedOrderId = order_id;
    let resolvedProviderTxRef = provider_transaction_id;
    const admin = createServiceRoleClient();

    // If payment_session_id provided, check eligibility
    if (payment_session_id) {
        const eligibility = await checkRetryEligibility(payment_session_id);

        if (!eligibility.eligible) {
            return NextResponse.json({
                data: {
                    payment_session_id,
                    status: 'skipped',
                    reason: eligibility.reason,
                },
            });
        }

        if (eligibility.txRef) {
            resolvedProviderTxRef = eligibility.txRef;
        }
        if (eligibility.orderId) {
            resolvedOrderId = eligibility.orderId;
        }
    }

    // If we have a transaction ID, verify with provider
    if (provider === 'chapa' && resolvedProviderTxRef) {
        const restaurantId = resolvedOrderId
            ? (
                  await admin
                      .from('orders')
                      .select('restaurant_id')
                      .eq('id', resolvedOrderId)
                      .maybeSingle()
              )?.data?.restaurant_id
            : payment_session_id
              ? (
                    await admin
                        .from('payment_sessions')
                        .select('restaurant_id')
                        .eq('id', payment_session_id)
                        .maybeSingle()
                )?.data?.restaurant_id
              : null;

        if (!restaurantId) {
            return NextResponse.json(
                {
                    error: {
                        code: 'RESTAURANT_NOT_FOUND',
                        message: 'Could not determine restaurant for payment retry',
                    },
                },
                { status: 400 }
            );
        }

        const result = await verifyAndProcessChapaPayment(
            resolvedProviderTxRef!,
            resolvedOrderId || null,
            restaurantId
        );

        // Update retry count in payment session
        if (payment_session_id) {
            const { data: session } = await admin
                .from('payment_sessions')
                .select('metadata')
                .eq('id', payment_session_id)
                .maybeSingle();

            const currentRetryCount =
                Number((session?.metadata as Record<string, unknown>)?.retry_count) || 0;

            await admin
                .from('payment_sessions')
                .update({
                    metadata: {
                        ...((session?.metadata as Record<string, unknown>) || {}),
                        retry_count: currentRetryCount + 1,
                        last_retry_at: new Date().toISOString(),
                        last_retry_status: result.status,
                    } as Json,
                })
                .eq('id', payment_session_id);
        }

        // If failed and not max retries, schedule another retry
        if (!result.success && retry_count < 5) {
            // Could queue another retry job here with exponential backoff
            // For now, just return the failure status
        }

        return NextResponse.json({
            data: {
                payment_session_id,
                order_id: resolvedOrderId,
                provider,
                provider_transaction_id: resolvedProviderTxRef,
                status: result.status,
                retry_count: retry_count + 1,
                error: result.error,
            },
        });
    }

    return NextResponse.json(
        {
            error: {
                code: 'INSUFFICIENT_DATA',
                message: 'payment_session_id or provider_transaction_id required',
            },
        },
        { status: 400 }
    );
}
