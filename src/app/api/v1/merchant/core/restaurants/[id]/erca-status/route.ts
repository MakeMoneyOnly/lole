/**
 * GET /api/restaurants/[id]/erca-status
 *
 * Returns real-time ERCA fiscal compliance status for a restaurant.
 * Includes submission success rate, last success time, pending count, and health indicators.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const ParamsSchema = z.object({
    id: z.string().uuid(),
});

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
    const { id: restaurantId } = ParamsSchema.parse(await params);
    const admin = createServiceRoleClient();

    const { data: restaurant, error: restaurantError } = await admin
        .from('restaurants')
        .select('vat_number, erca_enabled, tin_number')
        .eq('id', restaurantId)
        .single();

    if (restaurantError || !restaurant) {
        return NextResponse.json(
            { error: { code: 'NOT_FOUND', message: 'Restaurant not found' } },
            { status: 404 }
        );
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentSubmissions, error: submissionsError } = await admin
        .from('erca_submissions')
        .select('status, submitted_at, error_message')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(100);

    if (submissionsError) {
        return NextResponse.json(
            { error: { code: 'DB_ERROR', message: submissionsError.message } },
            { status: 500 }
        );
    }

    const submissions = recentSubmissions ?? [];
    const total = submissions.length;
    const successful = submissions.filter(s => s.status === 'success').length;
    const failed = submissions.filter(s => s.status === 'failed').length;
    const pending = submissions.filter(
        s => s.status === 'pending' || s.status === 'pending_fiscalization'
    ).length;

const lastSuccess = submissions.find(s => s.status === 'success');
     const consecutiveFailures = ((): number => {
        let count = 0;
        for (const s of submissions) {
            if (s.status === 'failed') count++;
            else break;
        }
        return count;
    })();

const isErcaEnabled = restaurant.erca_enabled === true && restaurant.vat_number != null;
     const isHealthy = isErcaEnabled && (total === 0 || successful / Math.max(total, 1) >= 0.9);
     const isWarning = isErcaEnabled && !isHealthy && consecutiveFailures < 5;
     const _isError = isErcaEnabled && consecutiveFailures >= 5;

    return NextResponse.json({
        data: {
            restaurant_id: restaurantId,
            erca_enabled: isErcaEnabled,
            tin_number: restaurant.tin_number,
            vat_number: restaurant.vat_number,
            status: !isErcaEnabled
                ? 'disabled'
                : isHealthy
                  ? 'healthy'
                  : isWarning
                    ? 'warning'
                    : 'error',
            last_24h: {
                total_submissions: total,
                successful,
                failed,
                pending,
                success_rate: total > 0 ? ((successful / total) * 100).toFixed(1) : null,
            },
            last_success_at: lastSuccess?.submitted_at ?? null,
            consecutive_failures: consecutiveFailures,
        },
    });
}
