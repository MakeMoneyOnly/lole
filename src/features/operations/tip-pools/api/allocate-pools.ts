import { apiSuccess, apiError } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { AllocateTipPoolCommandSchema, type TipAllocationResponse } from '../contracts';
import { writeAuditLog } from '@/lib/api/audit';
import { calculateTipDistribution } from '@/lib/pricing/tip-pool';

export async function allocatePoolsHandler(request: Request): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId, user } = auth;

        let body: Record<string, unknown>;
        try {
            body = await request.json();
        } catch {
            return apiError('Invalid JSON body', 400, 'INVALID_JSON');
        }

        const rawCommand = {
            restaurantId: restaurantId,
            staffId: user.id,
            ...body,
        };

        const validated = AllocateTipPoolCommandSchema.parse(rawCommand);
        const { tipPoolId, periodDate, shiftId, totalTipsCollected, totalBillAmount } = validated;

        // Get the tip pool with shares
        const { data: tipPool, error: poolError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('tip_pools')
                .select(
                    'id, restaurant_id, name, name_am, description, description_am, is_active, pool_type, pool_value, calculated_from, valid_from, valid_until, allocation_mode, created_by, created_at, updated_at'
                )
                .eq('id', tipPoolId)
                .eq('restaurant_id', restaurantId)
                .single();

        if (poolError || !tipPool) {
            return apiError('Tip pool not found', 404, 'TIP_POOL_NOT_FOUND');
        }

        if (!tipPool.is_active) {
            return apiError('Tip pool is not active', 400, 'TIP_POOL_INACTIVE');
        }

        // Get shares
        const { data: shares, error: sharesError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('tip_pool_shares')
                .select('id, tip_pool_id, restaurant_id, role, percentage, created_at, updated_at')
                .eq('tip_pool_id', tipPoolId);

        if (sharesError || !shares || shares.length === 0) {
            return apiError('No shares configured for tip pool', 400, 'TIP_POOL_NO_SHARES');
        }

        // Validate shares total doesn't exceed 100%
        const totalPercentage = shares.reduce(
            (sum: number, s: { percentage: number }) => sum + s.percentage,
            0
        );
        if (totalPercentage > 10000) {
            return apiError('Total shares cannot exceed 100%', 400, 'TIP_POOL_SHARES_EXCEED_100');
        }

        // Calculate pool amount
        let poolableTips = totalTipsCollected;
        if (tipPool.calculated_from === 'total' && totalBillAmount) {
            if (tipPool.pool_type === 'percentage') {
                poolableTips = Math.round(totalBillAmount * (tipPool.pool_value / 10000));
            } else {
                poolableTips = Math.min(tipPool.pool_value, totalBillAmount);
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

        const periodStart = new Date(periodDate);
        periodStart.setHours(0, 0, 0, 0);
        const periodEnd = new Date(periodDate);
        periodEnd.setHours(23, 59, 59, 999);

        // Create allocation record
        const { data: allocation, error: allocationError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('tip_allocations')
                .insert({
                    restaurant_id: restaurantId,
                    tip_pool_id: tipPoolId,
                    shift_id: shiftId ?? null,
                    period_date: periodDate,
                    period_start: periodStart.toISOString(),
                    period_end: periodEnd.toISOString(),
                    total_tips_collected: totalTipsCollected,
                    total_tips_pooled: poolableTips,
                    total_tips_distributed: distribution.reduce((sum, d) => sum + d.amount, 0),
                    distribution: distribution as Array<{ role: string; amount: number }>,
                    status: 'calculated',
                    created_by: user.id,
                })
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

        await writeAuditLog(supabase, {
            restaurant_id: restaurantId,
            user_id: user.id,
            action: 'tip_allocation_created',
            entity_type: 'tip_allocation',
            entity_id: allocation.id,
            metadata: {
                tip_pool_id: tipPoolId,
                period_date: periodDate,
                total_tips_collected: totalTipsCollected,
                poolable_tips: poolableTips,
                distribution_count: distribution.length,
            },
        });

        return apiSuccess({ allocation: allocation as TipAllocationResponse }, 201);
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'allocatePools',
        });
    }
}
