/**
 * POST /api/jobs/fiscal/replay
 *
 * Replays pending fiscal jobs from the offline queue.
 * Scheduled via QStash (every 5 minutes) or triggered by network reconnect.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

function isAuthorized(request: NextRequest): boolean {
    const configuredKey = process.env.QSTASH_TOKEN;
    if (!configuredKey) {
        return process.env.NODE_ENV !== 'production';
    }
    return request.headers.get('x-lole-job-key') === configuredKey;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isAuthorized(request)) {
        return NextResponse.json(
            { error: { code: 'UNAUTHORIZED_JOB', message: 'Job request is not authorized' } },
            { status: 401 }
        );
    }

    const admin = createServiceRoleClient();

    const { data: replayable, error } = await admin
        .from('erca_submissions')
        .select('id, order_id, status, retry_count')
        .in('status', ['failed', 'retry', 'pending_fiscalization'])
        .lt('retry_count', 5)
        .order('created_at', { ascending: true })
        .limit(20);

    if (error) {
        return NextResponse.json(
            { error: { code: 'DB_ERROR', message: error.message } },
            { status: 500 }
        );
    }

    if (!replayable || replayable.length === 0) {
        return NextResponse.json({
            data: { replayed: 0, message: 'No pending fiscal jobs to replay' },
        });
    }

    let replayed = 0;
    let failed = 0;

    for (const sub of replayable) {
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/jobs/orders/completed`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-lole-job-key': process.env.QSTASH_TOKEN ?? 'dev',
                    },
                    body: JSON.stringify({
                        id: crypto.randomUUID(),
                        version: 1,
                        name: 'order.completed',
                        occurred_at: new Date().toISOString(),
                        trace_id: crypto.randomUUID(),
                        payload: {
                            order_id: sub.order_id,
                            restaurant_id: '00000000-0000-0000-0000-000000000000',
                            trigger: 'manual',
                        },
                    }),
                }
            );

            if (response.ok) {
                replayed++;
            } else {
                failed++;
            }
        } catch {
            failed++;
        }
    }

    return NextResponse.json({
        data: {
            replayed,
            failed,
            total: replayable.length,
        },
    });
}
