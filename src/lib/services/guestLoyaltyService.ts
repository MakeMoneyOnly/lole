import { createServiceRoleClient } from '@/lib/supabase/service-role';

interface LoyaltyAccrualResult {
    applied: boolean;
    reason?: string;
    points?: number;
}

function computePoints(pointsRuleJson: unknown, eligibleSubtotal: number): number {
    const fallback = Math.floor(eligibleSubtotal);
    if (!pointsRuleJson || typeof pointsRuleJson !== 'object') return Math.max(0, fallback);

    const rule = pointsRuleJson as Record<string, unknown>;
    const rawPointsPerUnit = Number(rule.points_per_currency_unit ?? 1);
    const rawCurrencyUnit = Number(rule.currency_unit ?? 1);

    const pointsPerUnit =
        Number.isFinite(rawPointsPerUnit) && rawPointsPerUnit > 0 ? rawPointsPerUnit : 1;
    const currencyUnit =
        Number.isFinite(rawCurrencyUnit) && rawCurrencyUnit > 0 ? rawCurrencyUnit : 1;

    return Math.max(0, Math.floor((eligibleSubtotal / currencyUnit) * pointsPerUnit));
}

export async function accrueLoyaltyPointsForCompletedOrder(
    orderId: string
): Promise<LoyaltyAccrualResult> {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
        return { applied: false, reason: 'Service-role credentials are not configured.' };
    }

    const db = createServiceRoleClient();

    const { data: attribution, error: attributionError } = await db
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('order_guest_attributions' as any)
        .select('id, restaurant_id, table_id, auth_state, user_id, guest_id')
        .eq('order_id', orderId)
        .maybeSingle();

    if (attributionError) {
        return { applied: false, reason: attributionError.message };
    }
    if (!attribution || attribution.auth_state !== 'authenticated' || !attribution.user_id) {
        return { applied: false, reason: 'Order session is guest or not attributed.' };
    }

    const { data: existingEarn, error: earnLookupError } = await db
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('loyalty_transactions' as any)
        .select('id')
        .eq('order_id', orderId)
        .eq('transaction_type', 'earn')
        .limit(1)
        .maybeSingle();

    if (earnLookupError) {
        return { applied: false, reason: earnLookupError.message };
    }
    if (existingEarn) {
        return { applied: false, reason: 'Already accrued.' };
    }

    const [{ data: order, error: orderError }, { data: activeProgram, error: programError }] =
        await Promise.all([
            db.from('orders').select('id, total_price').eq('id', orderId).maybeSingle(),
            db
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .from('loyalty_programs' as any)
                .select('id, points_rule_json')
                .eq('restaurant_id', attribution.restaurant_id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);

    if (orderError) return { applied: false, reason: orderError.message };
    if (programError) return { applied: false, reason: programError.message };
    if (!order) return { applied: false, reason: 'Order not found.' };
    if (!activeProgram) return { applied: false, reason: 'No active loyalty program.' };

    const eligibleSubtotal = Number(order.total_price ?? 0);
    if (!Number.isFinite(eligibleSubtotal) || eligibleSubtotal <= 0) {
        return { applied: false, reason: 'Order not eligible for points.' };
    }

    const pointsToEarn = computePoints(activeProgram.points_rule_json, eligibleSubtotal);
    if (pointsToEarn <= 0) {
        return { applied: false, reason: 'Computed points is zero.' };
    }

    let guestId = attribution.guest_id as string | null;
    if (!guestId) {
        const identityKey = `auth:${attribution.user_id}`;
        const { data: guest, error: guestError } = await db
            .from('guests')
            .upsert(
                {
                    restaurant_id: attribution.restaurant_id,
                    identity_key: identityKey,
                    metadata: { source: 'qr_auth_session' },
                    last_seen_at: new Date().toISOString(),
                },
                { onConflict: 'restaurant_id,identity_key' }
            )
            .select('id')
            .single();

        if (guestError || !guest) {
            return { applied: false, reason: guestError?.message ?? 'Failed to resolve guest.' };
        }
        guestId = guest.id;
    }

    const { data: account, error: accountError } = await db
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('loyalty_accounts' as any)
        .upsert(
            {
                restaurant_id: attribution.restaurant_id,
                guest_id: guestId,
                program_id: activeProgram.id,
                status: 'active',
            },
            { onConflict: 'restaurant_id,guest_id,program_id' }
        )
        .select('id, points_balance')
        .single();

    if (accountError || !account) {
        return { applied: false, reason: accountError?.message ?? 'Failed to resolve account.' };
    }

    const currentBalance = Number(account.points_balance ?? 0);
    const nextBalance = currentBalance + pointsToEarn;

    const { error: updateBalanceError } = await db
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('loyalty_accounts' as any)
        .update({ points_balance: nextBalance })
        .eq('id', account.id);
    if (updateBalanceError) {
        return { applied: false, reason: updateBalanceError.message };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertTxError } = await db.from('loyalty_transactions' as any).insert({
        restaurant_id: attribution.restaurant_id,
        account_id: account.id,
        order_id: orderId,
        points_delta: pointsToEarn,
        balance_after: nextBalance,
        transaction_type: 'earn',
        reason: 'Order completed via QR menu',
        metadata: {
            source: 'qr_onboarding_authenticated',
            eligible_subtotal: eligibleSubtotal,
            user_id: attribution.user_id,
            attribution_id: attribution.id,
        },
    });
    if (insertTxError) {
        return { applied: false, reason: insertTxError.message };
    }

    await db
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('order_guest_attributions' as any)
        .update({ guest_id: guestId })
        .eq('id', attribution.id);

    const { data: existingVisit } = await db
        .from('guest_visits')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();

    if (!existingVisit) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await db.from('guest_visits' as any).insert({
            restaurant_id: attribution.restaurant_id,
            guest_id: guestId,
            order_id: orderId,
            table_id: attribution.table_id,
            channel: 'dine_in',
            spend: eligibleSubtotal,
            metadata: {
                source: 'qr_menu_authenticated',
                loyalty_points_earned: pointsToEarn,
            },
        });
    }

    return { applied: true, points: pointsToEarn };
}
