import { apiSuccess, apiError } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { ListTipPoolsQuerySchema, type TipPoolResponse, type TipPoolShare } from '../contracts';
import type { SupabaseClient } from '@supabase/supabase-js';

interface TipPoolShareRow {
    id: string;
    tip_pool_id: string;
    restaurant_id: string;
    role: string;
    percentage: number;
    created_at: string;
    updated_at: string;
}

export async function listPoolsHandler(request: Request): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId } = auth;

        const rawQuery = {
            restaurantId: restaurantId,
        };

        const validated = ListTipPoolsQuerySchema.parse(rawQuery);

        // Get tip pools with their shares
        const { data: pools, error: poolsError } = await (supabase as SupabaseClient)
            .from('tip_pools')
            .select(
                'id, restaurant_id, name, name_am, description, description_am, is_active, pool_type, pool_value, calculated_from, valid_from, valid_until, allocation_mode, created_by, created_at, updated_at'
            )
            .eq('restaurant_id', validated.restaurantId)
            .order('created_at', { ascending: false });

        if (poolsError) {
            return apiError(
                'Failed to load tip pools',
                500,
                'TIP_POOL_FETCH_FAILED',
                poolsError.message
            );
        }

        if (!pools || pools.length === 0) {
            return apiSuccess({ tip_pools: [], shares: {} });
        }

        const poolIds = pools.map((p: { id: string }) => p.id);

        // Get shares for all pools
        const { data: shares, error: sharesError } = await (supabase as SupabaseClient)
            .from('tip_pool_shares')
            .select('id, tip_pool_id, restaurant_id, role, percentage, created_at, updated_at')
            .in('tip_pool_id', poolIds)
            .order('role', { ascending: true });

        if (sharesError) {
            return apiError(
                'Failed to load tip pool shares',
                500,
                'TIP_POOL_SHARES_FETCH_FAILED',
                sharesError.message
            );
        }

        // Group shares by pool
        const sharesByPool: Record<string, TipPoolShare[]> = {};
        (shares ?? []).forEach((share: TipPoolShareRow) => {
            const tipPoolId = share.tip_pool_id;
            if (!sharesByPool[tipPoolId]) {
                sharesByPool[tipPoolId] = [];
            }
            sharesByPool[tipPoolId].push({
                role: share.role as TipPoolShare['role'],
                percentage: share.percentage,
            });
        });

        return apiSuccess({
            tip_pools: pools as TipPoolResponse[],
            shares: sharesByPool,
        });
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'listPools',
        });
    }
}
