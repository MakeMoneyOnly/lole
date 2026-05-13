import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { calculateTipDistribution } from '@/lib/pricing/tip-pool';

const AllocateTipSchema = z.object({
    tip_pool_id: z.string().uuid(),
    period_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    shift_id: z.string().uuid().optional(),
    total_tips_collected: z.number().int().min(0),
    total_bill_amount: z.number().int().min(0).optional(),
});

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, AllocateTipSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { tip_pool_id, period_date, shift_id, total_tips_collected, total_bill_amount } =
        parsed.data;
    const db = context.supabase;

    // Get the tip pool with shares
    const { data: tipPool, error: poolError } = await db
        .from('tip_pools')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, name_am, description, description_am, is_active, pool_type, pool_value, calculated_from, valid_from, valid_until, allocation_mode, created_by, created_at, updated_at'
        )
        .eq('id', tip_pool_id)
        .eq('restaurant_id', context.restaurantId)
        .single();

    if (poolError || !tipPool) {
        return apiError('Tip pool not found', 404, 'TIP_POOL_NOT_FOUND');
    }

    if (!tipPool.is_active) {
        return apiError('Tip pool is not active', 400, 'TIP_POOL_INACTIVE');
    }

    // Get shares
    const { data: shares, error: sharesError } = await db
        .from('tip_pool_shares')
        // HIGH-013: Explicit column selection
        .select('id, tip_pool_id, restaurant_id, role, percentage, created_at, updated_at')
        .eq('tip_pool_id', tip_pool_id);

    if (sharesError || !shares || shares.length === 0) {
        return apiError('No shares configured for tip pool', 400, 'TIP_POOL_NO_SHARES');
    }

    // Calculate pool amount
    let poolableTips = total_tips_collected;
    if (tipPool.calculated_from === 'total' && total_bill_amount) {
        if (tipPool.pool_type === 'percentage') {
            poolableTips = Math.round(total_bill_amount * (tipPool.pool_value / 10000));
        } else {
            poolableTips = Math.min(tipPool.pool_value, total_bill_amount);
        }
    }

    // Calculate distribution
    const distribution = calculateTipDistribution(
        poolableTips,
        shares.map((s: { role: string; percentage: number }) => ({
            role: s.role,
            percentage: s.percentage,
        }))
    );
    const periodStart = new Date(period_date);
    periodStart.setHours(0, 0, 0, 0);
    const periodEnd = new Date(period_date);
    periodEnd.setHours(23, 59, 59, 999);

    // Create allocation record
    const { data: allocation, error: allocationError } = await db
        .from('tip_allocations')
        .insert({
            restaurant_id: context.restaurantId,
            tip_pool_id,
            shift_id: shift_id ?? null,
            period_date,
            period_start: periodStart.toISOString(),
            period_end: periodEnd.toISOString(),
            total_tips_collected,
            total_tips_pooled: poolableTips,
            total_tips_distributed: distribution.reduce((sum, d) => sum + d.amount, 0),
            distribution: distribution as Array<{ role: string; amount: number }>,
            status: 'calculated',
            created_by: auth.user.id,
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, tip_pool_id, shift_id, period_date, period_start, period_end, total_tips_collected, total_tips_pooled, total_tips_distributed, distribution, status, created_by, created_at, updated_at'
        )
        .single();

    if (allocationError) {
        return apiError(
            'Failed to create tip allocation',
            500,
            'TIP_ALLOCATION_FAILED',
            allocationError.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'tip_allocation_created',
        entity_type: 'tip_allocation',
        entity_id: allocation.id,
        metadata: {
            tip_pool_id,
            period_date,
            total_tips_collected,
            poolable_tips: poolableTips,
            distribution_count: distribution.length,
        },
    });

    return apiSuccess({ allocation }, 201);
}
