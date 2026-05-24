/**
 * POST /api/jobs/orders/completed
 *
 * Job handler for order.completed events.
 * Processes loyalty points accrual, ERCA invoice submission,
 * and other post-order background tasks.
 *
 * This is triggered asynchronously via QStash when an order
 * status changes to 'completed'.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createloleEvent } from '@/lib/events/contracts';
import { publishEvent } from '@/lib/events/runtime';
import { accrueLoyaltyPointsForCompletedOrder } from '@/lib/services/guestLoyaltyService';
import { getERCAService } from '@/lib/fiscal/erca-service';
import { logger } from '@/lib/logger';

const log = logger.child('[jobs]');

const OrderCompletedEventSchema = z.object({
    order_id: z.string().uuid(),
    restaurant_id: z.string().uuid(),
    completed_at: z.string().datetime().optional(),
    trigger: z
        .enum(['table_close', 'payment_complete', 'kitchen_complete', 'manual'])
        .default('table_close'),
});

const JobPayloadSchema = z.object({
    id: z.string().uuid(),
    version: z.literal(1),
    name: z.literal('order.completed'),
    occurred_at: z.string().datetime(),
    trace_id: z.string().uuid(),
    payload: OrderCompletedEventSchema,
});

function isAuthorizedJobRequest(request: NextRequest): boolean {
    const configuredKey = process.env.QSTASH_TOKEN;
    if (!configuredKey) {
        return process.env.NODE_ENV !== 'production';
    }
    return request.headers.get('x-lole-job-key') === configuredKey;
}

/**
 * Process loyalty points for completed order
 */
async function handleLoyaltyAccrual(orderId: string): Promise<{
    success: boolean;
    pointsAwarded?: number;
    error?: string;
}> {
    try {
        const result = await accrueLoyaltyPointsForCompletedOrder(orderId);
        if (result.applied) {
            return { success: true, pointsAwarded: result.points };
        }
        return { success: true, error: result.reason };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown loyalty error';
        return { success: false, error: message };
    }
}

/**
 * Submit ERCA invoice directly for the completed order.
 * Uses the unified ERCAService instead of queuing a separate job.
 */
async function submitERCAForOrder(orderId: string): Promise<{
    success: boolean;
    erca_invoice_id?: string;
    error?: string;
}> {
    try {
        const ercaService = getERCAService();
        const result = await ercaService.submitInvoice(orderId);
        return {
            success: result.success,
            erca_invoice_id: result.erca_invoice_id,
            error: result.error,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown ERCA error';
        log.error(`ERCA submission failed for order ${orderId}`, undefined, { message });
        return { success: false, error: message };
    }
}

export async function POST(request: NextRequest): Promise<Response> {
    if (!isAuthorizedJobRequest(request)) {
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
    const parsed = JobPayloadSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            {
                error: {
                    code: 'INVALID_JOB_PAYLOAD',
                    message: 'Invalid order.completed event payload',
                    details: parsed.error.flatten(),
                },
            },
            { status: 400 }
        );
    }

    const { payload } = parsed.data;
    const { order_id, restaurant_id, trigger } = payload;

    const results: {
        loyalty: { success: boolean; pointsAwarded?: number; error?: string };
        erca: { success: boolean; erca_invoice_id?: string; error?: string };
    } = {
        loyalty: { success: false },
        erca: { success: false },
    };

    // Process loyalty points (only for authenticated guest orders)
    results.loyalty = await handleLoyaltyAccrual(order_id);

    // Submit ERCA invoice directly via unified service
    results.erca = await submitERCAForOrder(order_id);

    // Publish completion event to stream for other consumers
    const completionEvent = createloleEvent('order.completed', {
        order_id,
        restaurant_id,
        completed_at: payload.completed_at ?? new Date().toISOString(),
        trigger,
        processed: {
            loyalty: results.loyalty.success,
            erca: results.erca.success,
        },
    });

    await publishEvent(completionEvent).catch(err => {
        log.error(`Failed to publish order.completed event for ${order_id}`, err);
    });

    return NextResponse.json({
        data: {
            order_id,
            restaurant_id,
            processed: {
                loyalty: {
                    success: results.loyalty.success,
                    points_awarded: results.loyalty.pointsAwarded,
                    error: results.loyalty.error,
                },
                erca: {
                    success: results.erca.success,
                    erca_invoice_id: results.erca.erca_invoice_id,
                    error: results.erca.error,
                },
            },
        },
    });
}
