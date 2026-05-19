/**
 * Telebirr Webhook Handler
 *
 * Handles payment callbacks from Telebirr mobile money service.
 * Verifies signature and updates payment status.
 */

import { NextRequest } from 'next/server';
import { verifyTelebirrWebhookSignature } from '@/lib/payments/telebirr';
import { createAuditedServiceRoleClient } from '@/lib/supabase/service-role';
import { logger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function POST(request:  NextRequest): Promise<Response> {
    const startTime = Date.now();

    try {
        // Get raw body for signature verification
        const rawBody = await request.text();
        const signature = request.headers.get('x-telebirr-sign') ?? '';

        // Verify webhook signature
        const appKey = process.env.TELEBIRR_APP_KEY;
        if (!appKey) {
            logger.error('[TelebirrWebhook] TELEBIRR_APP_KEY not configured');
            return apiError('Webhook not configured', 500, 'TELEBIRR_NOT_CONFIGURED');
        }

        const isValid = verifyTelebirrWebhookSignature(rawBody, signature, appKey);
        if (!isValid) {
            logger.warn('[TelebirrWebhook] Invalid signature', {
                signature: signature.substring(0, 10) + '...',
            });
            return apiError('Invalid signature', 401, 'INVALID_SIGNATURE');
        }

        // Parse the payload
        const payload = JSON.parse(rawBody) as {
            outTradeNo: string;
            tradeNo: string;
            tradeStatus: string;
            totalAmount: string;
            currency: string;
            buyerId?: string;
            timestamp?: string;
        };

        logger.info('[TelebirrWebhook] Received payment callback', {
            outTradeNo: payload.outTradeNo,
            tradeStatus: payload.tradeStatus,
        });

        // Map Telebirr status to our status
        let paymentStatus: 'pending' | 'success' | 'failed' | 'cancelled';
        switch (payload.tradeStatus) {
            case 'TRADE_SUCCESS':
            case 'TRADE_FINISHED':
                paymentStatus = 'success';
                break;
            case 'TRADE_CLOSED':
                paymentStatus = 'cancelled';
                break;
            case 'WAIT_BUYER_PAY':
            default:
                paymentStatus = 'pending';
        }

        // Update payment record using audited service role client
        const supabase = createAuditedServiceRoleClient('telebirr_webhook', {
            metadata: {
                tradeNo: payload.tradeNo,
                outTradeNo: payload.outTradeNo,
            },
        });

        // Find payment by transaction reference
        const { data: payment, error: findError } = await supabase
            .from('payments')
            .select('id, order_id, restaurant_id')
            .eq('provider_reference', payload.outTradeNo)
            .maybeSingle();

        if (findError) {
            logger.error('[TelebirrWebhook] Error finding payment', findError);
            return apiError('Database error', 500, 'DB_ERROR', findError.message);
        }

        if (!payment) {
            logger.warn('[TelebirrWebhook] Payment not found', {
                outTradeNo: payload.outTradeNo,
            });
            // Return success to prevent retries for unknown payments
            return apiSuccess({ received: true });
        }

        // Update payment status
        const { error: updateError } = await supabase
            .from('payments')
            .update({
                status: paymentStatus,
                provider_transaction_id: payload.tradeNo,
                metadata: {
                    buyerId: payload.buyerId,
                    telebirrTimestamp: payload.timestamp,
                    rawCallback: payload,
                },
                updated_at: new Date().toISOString(),
            })
            .eq('id', payment.id);

        if (updateError) {
            logger.error('[TelebirrWebhook] Error updating payment', updateError);
            return apiError(
                'Failed to update payment',
                500,
                'PAYMENT_UPDATE_FAILED',
                updateError.message
            );
        }

        // If payment successful, update order status
        if (paymentStatus === 'success' && payment.order_id) {
            const { error: orderUpdateError } = await supabase
                .from('orders')
                .update({
                    payment_status: 'paid',
                    status: 'confirmed',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payment.order_id);

            if (orderUpdateError) {
                logger.error('[TelebirrWebhook] Error updating order', orderUpdateError);
                // Don't fail the webhook - payment was updated successfully
            }
        }

        const duration = Date.now() - startTime;
        logger.info('[TelebirrWebhook] Payment processed', {
            outTradeNo: payload.outTradeNo,
            status: paymentStatus,
            durationMs: duration,
        });

        return apiSuccess({ received: true });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error('[TelebirrWebhook] Error processing webhook', {
            error: error instanceof Error ? error.message : 'Unknown error',
            durationMs: duration,
        });

        return apiError(
            'Internal server error',
            500,
            'INTERNAL_ERROR',
            error instanceof Error ? error.message : 'Unknown error'
        );
    }
}

// Only allow POST requests
export async function GET(_request: Request): Promise<Response> {
    return apiError('Method not allowed', 405, 'METHOD_NOT_ALLOWED');
}








