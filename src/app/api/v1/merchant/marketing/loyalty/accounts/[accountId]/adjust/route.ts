import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import type { Json } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

interface LoyaltyAccountRow {
    id: string;
    points_balance: number;
    guest_id: string | null;
    program_id: string | null;
    status: string;
    restaurant_id: string;
    updated_at?: string;
}

const AccountIdSchema = z.string().uuid();

const AdjustLoyaltySchema = z.object({
    points_delta: z.coerce
        .number()
        .int()
        .min(-100000)
        .max(100000)
        .refine(value => value !== 0, {
            message: 'points_delta must not be 0',
        }),
    reason: z.string().trim().min(2).max(200),
    order_id: z.string().uuid().optional(),
});

export async function POST(
    request: Request,
    routeContext: { params: Promise<{ accountId: string }> }
) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) {
        return context.response;
    }

    const { accountId } = await routeContext.params;
    const accountIdParsed = AccountIdSchema.safeParse(accountId);
    if (!accountIdParsed.success) {
        return apiError(
            'Invalid account id',
            400,
            'INVALID_LOYALTY_ACCOUNT_ID',
            accountIdParsed.error.flatten()
        );
    }

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const db = context.supabase as SupabaseClient<Database>;

    const parsed = await parseJsonBody(request, AdjustLoyaltySchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { data: account, error: accountError } = (await db
        .from('loyalty_accounts')
        .select('id, points_balance, guest_id, program_id, status')
        .eq('id', accountIdParsed.data)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle()) as { data: LoyaltyAccountRow | null; error: { message?: string } | null };

    if (accountError) {
        return apiError(
            'Failed to load loyalty account',
            500,
            'LOYALTY_ACCOUNT_FETCH_FAILED',
            accountError.message ?? 'Unknown error'
        );
    }
    if (!account) {
        return apiError('Loyalty account not found', 404, 'LOYALTY_ACCOUNT_NOT_FOUND');
    }
    if (account.status !== 'active') {
        return apiError('Loyalty account is not active', 409, 'LOYALTY_ACCOUNT_INACTIVE');
    }

    const balanceAfter = Number(account.points_balance) + parsed.data.points_delta;
    if (balanceAfter < 0) {
        return apiError(
            'Insufficient point balance for adjustment',
            409,
            'LOYALTY_INSUFFICIENT_POINTS'
        );
    }

    const { data: updated, error: updateError } = (await db
        .from('loyalty_accounts')
        .update({
            points_balance: balanceAfter,
            updated_at: new Date().toISOString(),
        })
        .eq('id', account.id)
        .eq('restaurant_id', context.restaurantId)
        // HIGH-013: Explicit column selection
        .select(
            'id, guest_id, program_id, restaurant_id, points_balance, tier, status, total_visits, total_points_earned, last_visit_at, created_at, updated_at'
        )
        .single()) as { data: LoyaltyAccountRow | null; error: { message?: string } | null };

    if (updateError) {
        return apiError(
            'Failed to update loyalty balance',
            500,
            'LOYALTY_ACCOUNT_UPDATE_FAILED',
            updateError.message ?? 'Unknown error'
        );
    }

    const transactionType = parsed.data.points_delta > 0 ? 'adjustment_credit' : 'adjustment_debit';

    const { data: transaction, error: txError } = (await db
        .from('loyalty_transactions')
        .insert({
            restaurant_id: context.restaurantId,
            account_id: account.id,
            order_id: parsed.data.order_id ?? null,
            points_delta: parsed.data.points_delta,
            balance_after: balanceAfter,
            transaction_type: transactionType,
            reason: parsed.data.reason,
            metadata: {
                source: 'merchant_dashboard',
                idempotency_key: idempotencyKey,
            } as Json,
            created_by: auth.user.id,
        })
        .select(
            'id, account_id, restaurant_id, order_id, points_delta, balance_after, transaction_type, reason, metadata, created_by, created_at'
        )
        .single()) as { data: { id: string } | null; error: { message?: string } | null };

    if (txError) {
        return apiError(
            'Failed to write loyalty transaction',
            500,
            'LOYALTY_TRANSACTION_CREATE_FAILED',
            txError.message ?? 'Unknown error'
        );
    }

    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'loyalty_account_adjusted',
        entity_type: 'loyalty_account',
        entity_id: account.id,
        old_value: { points_balance: account.points_balance },
        new_value: { points_balance: balanceAfter, points_delta: parsed.data.points_delta },
        metadata: {
            reason: parsed.data.reason,
            transaction_id: (transaction as { id: string }).id,
            idempotency_key: idempotencyKey,
        },
    });

    return apiSuccess({ account: updated, transaction, idempotency_key: idempotencyKey });
}
