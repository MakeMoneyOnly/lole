import { NextRequest } from 'next/server';
import {
    parseChapaWebhook,
    publishPaymentWebhookEvent,
    verifyChapaWebhookSignature,
} from '@/lib/payments/webhooks';
import { apiSuccess, apiError } from '@/lib/api/response';

export async function GET(request: Request): Promise<Response> {
    // Chapa browser redirects may still hit old callback expectations.
    // We acknowledge the request but only POST deliveries trigger state changes.
    return apiSuccess({ received: true, ignored: true });
}

export async function POST(request:  NextRequest): Promise<Response> {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-chapa-signature');

        if (!verifyChapaWebhookSignature(rawBody, signature)) {
            return apiError('Invalid Chapa webhook signature', 401, 'INVALID_SIGNATURE');
        }

        const parsed = parseChapaWebhook(rawBody, request.nextUrl.searchParams);
        const published = await publishPaymentWebhookEvent(parsed);

        return apiSuccess({
            received: true,
            event_id: published.eventId,
            job_message_id: published.jobMessageId ?? null,
        });
    } catch (error) {
        return apiError(
            'Failed to process Chapa webhook',
            500,
            'WEBHOOK_PROCESSING_FAILED',
            error instanceof Error ? error.message : 'Unknown webhook error'
        );
    }
}








