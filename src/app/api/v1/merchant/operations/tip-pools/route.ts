import { listPools, allocatePools } from '@/features/operations/tip-pools';

export async function GET(request: Request): Promise<Response> {
    return listPools(request);
}

export async function POST(request: Request): Promise<Response> {
    // This endpoint handles both list creation and allocation
    // Based on the body content, route to appropriate handler
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'allocate') {
        return allocatePools(request);
    }

    // Default: create tip pool (handled by existing logic)
    const { apiError, apiSuccess } = await import('@/lib/api/response');
    const { getAuthenticatedUser, getAuthorizedRestaurantContext } =
        await import('@/lib/api/authz');
    const { parseJsonBody } = await import('@/lib/api/validation');
    const { writeAuditLog } = await import('@/lib/api/audit');
    const { z } = await import('zod');

    const CreateTipPoolSchema = z.object({
        name: z.string().trim().min(1).max(120),
        name_am: z.string().trim().max(120).optional().nullable(),
        description: z.string().trim().max(500).optional().nullable(),
        is_active: z.boolean().optional().default(true),
        pool_type: z.enum(['percentage', 'fixed_amount']).default('percentage'),
        pool_value: z.number().int().min(0).default(0),
        calculated_from: z.enum(['tips', 'total']).default('tips'),
        valid_from: z.string().datetime().optional().nullable(),
        valid_until: z.string().datetime().optional().nullable(),
        allocation_mode: z.enum(['shift', 'daily', 'weekly']).default('shift'),
    });

    const TipPoolShareSchema = z.object({
        role: z.enum([
            'server',
            'bartender',
            'host',
            'busser',
            'kitchen',
            'manager',
            'cook',
            'barista',
        ]),
        percentage: z.number().int().min(0).max(10000),
    });

    const CreateTipPoolWithSharesSchema = z.object({
        tip_pool: CreateTipPoolSchema,
        shares: z.array(TipPoolShareSchema).min(1),
    });

    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, CreateTipPoolWithSharesSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { tip_pool, shares } = parsed.data;

    const totalPercentage = shares.reduce((sum, s) => sum + s.percentage, 0);
    if (totalPercentage > 10000) {
        return apiError('Total shares cannot exceed 100%', 400, 'TIP_POOL_SHARES_EXCEED_100');
    }

    const db = context.supabase;

    const { data: pool, error: poolError } = await db
        .from('tip_pools')
        .insert({
            restaurant_id: context.restaurantId,
            created_by: auth.user.id,
            ...tip_pool,
        })
        .select(
            'id, restaurant_id, name, name_am, description, description_am, is_active, pool_type, pool_value, calculated_from, valid_from, valid_until, allocation_mode, created_by, created_at, updated_at'
        )
        .single();

    if (poolError || !pool) {
        return apiError(
            'Failed to create tip pool',
            500,
            'TIP_POOL_CREATE_FAILED',
            poolError?.message
        );
    }

    const sharesData = shares.map(share => ({
        restaurant_id: context.restaurantId,
        tip_pool_id: pool.id,
        role: share.role,
        percentage: share.percentage,
    }));

    const { error: sharesError } = await db.from('tip_pool_shares').insert(sharesData);

    if (sharesError) {
        await db.from('tip_pools').delete().eq('id', pool.id);
        return apiError(
            'Failed to create tip pool shares',
            500,
            'TIP_POOL_SHARES_CREATE_FAILED',
            sharesError.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'tip_pool_created',
        entity_type: 'tip_pool',
        entity_id: pool.id,
        metadata: { name: pool.name, shares_count: shares.length },
    });

    return apiSuccess({ tip_pool: pool, shares }, 201);
}
