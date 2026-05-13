import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { PaymentLifecycleEvent } from '@/lib/events/contracts';
import { processPaymentLifecycleEvent } from '@/lib/payments/payment-event-consumer';

const PaymentLifecycleEventSchema = z.object({
    id: z.string().uuid(),
    version: z.literal(1),
    name: z.enum(['payment.completed', 'payment.failed']),
    occurred_at: z.string().datetime(),
    trace_id: z.string().uuid(),
    payload: z.object({
        restaurant_id: z.string().uuid(),
        order_id: z.string().uuid().nullable(),
        payment_id: z.string().uuid().nullable(),
        provider: z.enum(['chapa']),
        provider_transaction_id: z.string().min(1),
        idempotency_key: z.string().min(1),
        status: z.enum(['completed', 'failed']),
        amount: z.number().nullable(),
        currency: z.string().nullable(),
        metadata: z.record(z.string(), z.unknown()),
        raw_payload: z.record(z.string(), z.unknown()),
    }),
});

function isAuthorizedJobRequest(request: NextRequest): boolean {
    const configuredKey = process.env.QSTASH_TOKEN;
    if (!configuredKey) {
        return process.env.NODE_ENV !== 'production';
    }

    return request.headers.get('x-lole-job-key') === configuredKey;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
    const parsed = PaymentLifecycleEventSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            {
                error: {
                    code: 'INVALID_JOB_PAYLOAD',
                    message: 'Invalid payment event payload',
                    details: parsed.error.flatten(),
                },
            },
            { status: 400 }
        );
    }

    const result = await processPaymentLifecycleEvent(parsed.data as PaymentLifecycleEvent);

    return NextResponse.json({
        data: result,
    });
}
