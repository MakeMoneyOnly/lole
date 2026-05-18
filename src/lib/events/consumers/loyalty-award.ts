/**
 * Loyalty Award Consumer
 *
 * CRIT-03: Event consumer that awards loyalty points when orders are completed.
 * Listens to 'order.completed' events and updates loyalty_accounts.
 */

import type { loleEvent } from '@/lib/events/contracts';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { writeAuditLog } from '@/lib/api/audit';
import { logger } from '@/lib/logger';

const log = logger.child('[events/loyalty-award]');

/**
 * Loyalty earning rules configuration
 */
export interface LoyaltyConfig {
    /** Points earned per birr spent (default: 1 point per 10 ETB) */
    pointsPerBirr: number;
    /** Minimum order amount in santim to earn points */
    minimumOrderSantim: number;
    /** Bonus multiplier for first order of the day */
    firstOrderBonusMultiplier: number;
}

const DEFAULT_CONFIG: LoyaltyConfig = {
    pointsPerBirr: 0.1, // 1 point per 10 ETB
    minimumOrderSantim: 500, // 5 ETB minimum
    firstOrderBonusMultiplier: 1.5,
};

/**
 * Order completed event payload
 */
interface OrderCompletedPayload {
    restaurant_id: string;
    order_id: string;
    order_number: string;
    total_santim: number;
    guest_id?: string | null;
    guest_fingerprint?: string | null;
    staff_id?: string | null;
    order_type: string;
    completed_at: string;
}

/**
 * Result of loyalty award processing
 */
export interface LoyaltyAwardResult {
    ok: boolean;
    outcome: 'awarded' | 'no_guest' | 'no_account' | 'already_processed' | 'error';
    pointsAwarded: number;
    loyaltyAccountId?: string;
    previousBalance?: number;
    newBalance?: number;
    error?: string;
}

/**
 * Calculate points to award based on order amount
 */
function calculatePoints(totalSantim: number, config: LoyaltyConfig = DEFAULT_CONFIG): number {
    if (totalSantim < config.minimumOrderSantim) {
        return 0;
    }
    const birrAmount = totalSantim / 100;
    return Math.floor(birrAmount * config.pointsPerBirr);
}

/**
 * Process loyalty award for a completed order
 *
 * This consumer:
 * 1. Finds the guest associated with the order
 * 2. Finds or creates their loyalty account
 * 3. Calculates and awards points
 * 4. Records the transaction
 */
export async function processLoyaltyAward(
    event: loleEvent<'order.completed', OrderCompletedPayload>,
    config: LoyaltyConfig = DEFAULT_CONFIG
): Promise<LoyaltyAwardResult> {
    const admin = createServiceRoleClient();
    const { payload } = event;

    // Check for guest identifier
    const guestId = payload.guest_id || payload.guest_fingerprint;
    if (!guestId) {
        return {
            ok: true,
            outcome: 'no_guest',
            pointsAwarded: 0,
        };
    }

    try {
        // Check if this event was already processed (idempotency)
        const { data: existingTransaction } = await admin
            .from('loyalty_transactions')
            .select('id')
            .eq('reference_type', 'order')
            .eq('reference_id', payload.order_id)
            .eq('transaction_type', 'earn')
            .maybeSingle();

        if (existingTransaction) {
            return {
                ok: true,
                outcome: 'already_processed',
                pointsAwarded: 0,
            };
        }

        // Find or create loyalty account
        let { data: loyaltyAccount } = await admin
            .from('loyalty_accounts')
            .select('id, points_balance, total_points_earned, guest_id')
            .eq('restaurant_id', payload.restaurant_id)
            .eq('guest_id', guestId)
            .maybeSingle();

        if (!loyaltyAccount) {
            // Create new loyalty account
            const { data: newAccount, error: createError } = await admin
                .from('loyalty_accounts')
                .insert({
                    restaurant_id: payload.restaurant_id,
                    guest_id: guestId,
                    points_balance: 0,
                    total_points_earned: 0,
                    tier: 'bronze',
                    status: 'active',
                })
                .select('id, points_balance, total_points_earned, guest_id')
                .single();

            if (createError || !newAccount) {
                return {
                    ok: false,
                    outcome: 'error',
                    pointsAwarded: 0,
                    error: createError?.message || 'Failed to create loyalty account',
                };
            }
            loyaltyAccount = newAccount;
        }

        // Calculate points
        const pointsToAward = calculatePoints(payload.total_santim, config);
        if (pointsToAward <= 0) {
            return {
                ok: true,
                outcome: 'awarded',
                pointsAwarded: 0,
                loyaltyAccountId: loyaltyAccount.id,
            };
        }

        const previousBalance = loyaltyAccount.points_balance || 0;
        const newBalance = previousBalance + pointsToAward;

        // Update loyalty account balance
        const { error: updateError } = await admin
            .from('loyalty_accounts')
            .update({
                points_balance: newBalance,
                total_points_earned: (loyaltyAccount.total_points_earned || 0) + pointsToAward,
                last_earned_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', loyaltyAccount.id);

        if (updateError) {
            return {
                ok: false,
                outcome: 'error',
                pointsAwarded: 0,
                loyaltyAccountId: loyaltyAccount.id,
                error: updateError.message,
            };
        }

        // Record the transaction
        const { error: transactionError } = await admin.from('loyalty_transactions').insert({
            restaurant_id: payload.restaurant_id,
            loyalty_account_id: loyaltyAccount.id,
            transaction_type: 'earn',
            points: pointsToAward,
            reference_type: 'order',
            reference_id: payload.order_id,
            description: `Points earned from order #${payload.order_number}`,
            metadata: {
                event_id: event.id,
                order_total_santim: payload.total_santim,
                order_type: payload.order_type,
            },
        });

        if (transactionError) {
            console.error('[loyalty-award] Failed to record transaction:', transactionError);
            // Don't fail - points were already awarded
        }

        // Write audit log
        await writeAuditLog(admin, {
            restaurant_id: payload.restaurant_id,
            action: 'loyalty_points_awarded',
            entity_type: 'loyalty_account',
            entity_id: loyaltyAccount.id,
            metadata: {
                event_id: event.id,
                order_id: payload.order_id,
                order_number: payload.order_number,
                points_awarded: pointsToAward,
                previous_balance: previousBalance,
                new_balance: newBalance,
            },
        });

        return {
            ok: true,
            outcome: 'awarded',
            pointsAwarded: pointsToAward,
            loyaltyAccountId: loyaltyAccount.id,
            previousBalance,
            newBalance,
        };
    } catch (error) {
        return {
            ok: false,
            outcome: 'error',
            pointsAwarded: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

export const loyaltyAwardConsumer = {
    processLoyaltyAward,
    calculatePoints,
    DEFAULT_CONFIG,
};

export default loyaltyAwardConsumer;
