/**
 * Enhanced Loyalty Service
 *
 * Implements:
 * - Visit-Based Rewards (rewards after N visits)
 * - Tiered Loyalty (Bronze/Silver/Gold levels)
 * - Birthday Rewards (automated birthday offers)
 *
 * P1 features from TOAST_FEATURE_TASKS.md
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// =========================================================
// Type Definitions
// =========================================================

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface TierConfig {
    name: LoyaltyTier;
    min_points: number;
    min_visits: number;
    points_multiplier: number;
    benefits: string[];
    color: string;
}

export interface VisitRewardConfig {
    visits_required: number;
    reward_type: 'points' | 'percentage_discount' | 'free_item';
    reward_value: number;
    reward_item_id?: string;
    name: string;
}

export interface BirthdayRewardConfig {
    points_bonus: number;
    discount_percentage?: number;
    free_item_id?: string;
    valid_days_before: number;
    valid_days_after: number;
}

export interface LoyaltyAccountWithMeta {
    id: string;
    guest_id: string;
    program_id: string;
    points_balance: number;
    tier: LoyaltyTier;
    total_visits: number;
    total_points_earned: number;
    last_visit_at: string | null;
    birthday: string | null;
    metadata: Record<string, unknown>;
}

export interface LoyaltyProgramConfig {
    points_per_currency_unit: number;
    currency_unit: number;
    tiers: TierConfig[];
    visit_rewards: VisitRewardConfig[];
    birthday_reward: BirthdayRewardConfig;
}

// =========================================================
// Default Tier Configuration
// =========================================================

export const DEFAULT_TIERS: TierConfig[] = [
    {
        name: 'bronze',
        min_points: 0,
        min_visits: 0,
        points_multiplier: 1.0,
        benefits: ['Earn 1 point per 1 ETB spent'],
        color: '#CD7F32',
    },
    {
        name: 'silver',
        min_points: 500,
        min_visits: 10,
        points_multiplier: 1.25,
        benefits: ['Earn 1.25x points', '5% birthday discount'],
        color: '#C0C0C0',
    },
    {
        name: 'gold',
        min_points: 1500,
        min_visits: 30,
        points_multiplier: 1.5,
        benefits: ['Earn 1.5x points', '10% birthday discount', 'Priority support'],
        color: '#FFD700',
    },
    {
        name: 'platinum',
        min_points: 5000,
        min_visits: 75,
        points_multiplier: 2.0,
        benefits: ['Earn 2x points', '15% birthday discount', 'Exclusive offers', 'Free delivery'],
        color: '#E5E4E2',
    },
];

export const DEFAULT_VISIT_REWARDS: VisitRewardConfig[] = [
    { visits_required: 5, reward_type: 'points', reward_value: 50, name: '5 Visit Bonus' },
    {
        visits_required: 10,
        reward_type: 'percentage_discount',
        reward_value: 10,
        name: '10 Visit 10% Off',
    },
    { visits_required: 25, reward_type: 'points', reward_value: 200, name: '25 Visit Milestone' },
    {
        visits_required: 50,
        reward_type: 'percentage_discount',
        reward_value: 20,
        name: '50 Visit 20% Off',
    },
];

export const DEFAULT_BIRTHDAY_REWARD: BirthdayRewardConfig = {
    points_bonus: 100,
    discount_percentage: 10,
    valid_days_before: 7,
    valid_days_after: 7,
};

// =========================================================
// Tier Calculation
// =========================================================

/**
 * Calculate the appropriate tier for a guest based on points and visits
 */
export function calculateTier(
    points: number,
    visits: number,
    tiers: TierConfig[] = DEFAULT_TIERS
): LoyaltyTier {
    // Sort tiers by min_points descending to find highest qualifying tier
    const sortedTiers = [...tiers].sort((a, b) => b.min_points - a.min_points);

    for (const tier of sortedTiers) {
        const meetsPoints = points >= tier.min_points;
        const meetsVisits = visits >= tier.min_visits;

        // Must meet at least one criteria, and both if both are set
        const qualifies =
            tier.min_points > 0 && tier.min_visits > 0
                ? meetsPoints && meetsVisits
                : meetsPoints || meetsVisits;

        if (qualifies) {
            return tier.name;
        }
    }

    return 'bronze';
}

/**
 * Get tier configuration by name
 */
export function getTierConfig(tier: LoyaltyTier, tiers: TierConfig[] = DEFAULT_TIERS): TierConfig {
    return tiers.find(t => t.name === tier) ?? DEFAULT_TIERS[0];
}

/**
 * Get points multiplier for a tier
 */
export function getPointsMultiplier(
    tier: LoyaltyTier,
    tiers: TierConfig[] = DEFAULT_TIERS
): number {
    return getTierConfig(tier, tiers).points_multiplier;
}

// =========================================================
// Visit Tracking & Rewards
// =========================================================

/**
 * Record a visit for a guest and check for visit-based rewards
 */
export async function recordGuestVisit(params: {
    supabase: SupabaseClient;
    restaurantId: string;
    guestId: string;
    orderId: string;
    orderTotal: number;
    programConfig?: LoyaltyProgramConfig;
}): Promise<{
    visitRecorded: boolean;
    newVisitCount: number;
    visitRewardsEarned: Array<{
        name: string;
        type: string;
        value: number;
    }>;
    error?: string;
}> {
    const { supabase, restaurantId, guestId, orderId, orderTotal, programConfig } = params;
    // Tables: loyalty_accounts, guest_visits, loyalty_transactions, guest_rewards not in Database schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Get or create loyalty account
        // HIGH-013: Explicit column selection
        const accountResult = await db
            .from('loyalty_accounts')
            .select(
                'id, guest_id, restaurant_id, points_balance, tier, total_visits, total_points_earned, status, last_visit_at'
            )
            .eq('guest_id', guestId)
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        let account = accountResult.data;
        const accountError = accountResult.error;

        if (accountError) {
            return {
                visitRecorded: false,
                newVisitCount: 0,
                visitRewardsEarned: [],
                error: accountError.message,
            };
        }

        if (!account) {
            // Create account if doesn't exist
            const { data: newAccount, error: createError } = await db
                .from('loyalty_accounts')
                .insert({
                    restaurant_id: restaurantId,
                    guest_id: guestId,
                    points_balance: 0,
                    tier: 'bronze',
                    total_visits: 0,
                    total_points_earned: 0,
                    status: 'active',
                })
                // HIGH-013: Explicit column selection
                .select(
                    'id, guest_id, restaurant_id, points_balance, tier, total_visits, total_points_earned, status, last_visit_at'
                )
                .single();

            if (createError) {
                return {
                    visitRecorded: false,
                    newVisitCount: 0,
                    visitRewardsEarned: [],
                    error: createError.message,
                };
            }
            account = newAccount;
        }

        // Check if this order was already counted as a visit
        const { data: existingVisit } = await db
            .from('guest_visits')
            .select('id')
            .eq('guest_id', guestId)
            .eq('order_id', orderId)
            .maybeSingle();

        if (existingVisit) {
            // Already recorded
            return {
                visitRecorded: false,
                newVisitCount: account.total_visits,
                visitRewardsEarned: [],
            };
        }

        // Record the visit
        const newVisitCount = (account.total_visits ?? 0) + 1;
        const now = new Date().toISOString();

        await db.from('guest_visits').insert({
            restaurant_id: restaurantId,
            guest_id: guestId,
            order_id: orderId,
            visit_number: newVisitCount,
            amount_spent: orderTotal,
            visited_at: now,
        });

        // Update account with new visit count
        await db
            .from('loyalty_accounts')
            .update({
                total_visits: newVisitCount,
                last_visit_at: now,
            })
            .eq('id', account.id);

        // Check for visit-based rewards
        const visitRewards = programConfig?.visit_rewards ?? DEFAULT_VISIT_REWARDS;
        const visitRewardsEarned: Array<{ name: string; type: string; value: number }> = [];

        for (const reward of visitRewards) {
            if (newVisitCount === reward.visits_required) {
                // Award the visit reward
                visitRewardsEarned.push({
                    name: reward.name,
                    type: reward.reward_type,
                    value: reward.reward_value,
                });

                // If points reward, add to balance
                if (reward.reward_type === 'points') {
                    await db
                        .from('loyalty_accounts')
                        .update({
                            points_balance: account.points_balance + reward.reward_value,
                            total_points_earned: account.total_points_earned + reward.reward_value,
                        })
                        .eq('id', account.id);

                    // Record transaction
                    await db.from('loyalty_transactions').insert({
                        restaurant_id: restaurantId,
                        account_id: account.id,
                        points_delta: reward.reward_value,
                        balance_after: account.points_balance + reward.reward_value,
                        transaction_type: 'visit_reward',
                        reason: reward.name,
                        metadata: { visit_number: newVisitCount },
                    });
                }

                // Create a coupon/voucher for discount or free item rewards
                if (
                    reward.reward_type === 'percentage_discount' ||
                    reward.reward_type === 'free_item'
                ) {
                    await db.from('guest_rewards').insert({
                        restaurant_id: restaurantId,
                        guest_id: guestId,
                        reward_type: reward.reward_type,
                        reward_value: reward.reward_value,
                        reward_item_id: reward.reward_item_id,
                        name: reward.name,
                        source: 'visit_milestone',
                        source_metadata: { visit_number: newVisitCount },
                        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
                        status: 'available',
                    });
                }
            }
        }

        // Check for tier upgrade
        const newTier = calculateTier(account.points_balance, newVisitCount, programConfig?.tiers);

        if (newTier !== account.tier) {
            await db.from('loyalty_accounts').update({ tier: newTier }).eq('id', account.id);

            // Record tier change
            await db.from('loyalty_transactions').insert({
                restaurant_id: restaurantId,
                account_id: account.id,
                points_delta: 0,
                balance_after: account.points_balance,
                transaction_type: 'tier_upgrade',
                reason: `Upgraded to ${newTier}`,
                metadata: { old_tier: account.tier, new_tier: newTier },
            });
        }

        return {
            visitRecorded: true,
            newVisitCount,
            visitRewardsEarned,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            visitRecorded: false,
            newVisitCount: 0,
            visitRewardsEarned: [],
            error: errorMessage,
        };
    }
}

// =========================================================
// Birthday Rewards
// =========================================================

/**
 * Check if a guest is eligible for birthday rewards and create them
 */
export async function processBirthdayReward(params: {
    supabase: SupabaseClient;
    restaurantId: string;
    guestId: string;
    birthdayConfig?: BirthdayRewardConfig;
}): Promise<{
    rewardCreated: boolean;
    reward?: {
        type: string;
        value: number;
        expiresAt: string;
    };
    error?: string;
}> {
    const { supabase, restaurantId, guestId, birthdayConfig } = params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const config = birthdayConfig ?? DEFAULT_BIRTHDAY_REWARD;

    try {
        // Get guest with birthday info
        const { data: guest, error: guestError } = await db
            .from('guests')
            .select('id, birthday, loyalty_accounts(id, points_balance, tier)')
            .eq('id', guestId)
            .maybeSingle();

        if (guestError) {
            return { rewardCreated: false, error: guestError.message };
        }

        if (!guest || !guest.birthday) {
            return { rewardCreated: false };
        }

        // Check if today is within birthday window
        const today = new Date();
        const birthday = new Date(guest.birthday);

        // Set birthday to current year
        birthday.setFullYear(today.getFullYear());

        // If birthday has passed this year, check for next year
        if (birthday < today) {
            birthday.setFullYear(today.getFullYear() + 1);
        }

        const daysUntilBirthday = Math.floor(
            (birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if within valid window
        const isValidWindow =
            daysUntilBirthday <= config.valid_days_before &&
            daysUntilBirthday >= -config.valid_days_after;

        if (!isValidWindow) {
            return { rewardCreated: false };
        }

        // Check if birthday reward already given this year
        const startOfYear = new Date(today.getFullYear(), 0, 1).toISOString();
        const { data: existingReward } = await db
            .from('guest_rewards')
            .select('id')
            .eq('guest_id', guestId)
            .eq('restaurant_id', restaurantId)
            .eq('source', 'birthday')
            .gte('created_at', startOfYear)
            .maybeSingle();

        if (existingReward) {
            return { rewardCreated: false };
        }

        // Create birthday reward
        const expiresAt = new Date(birthday);
        expiresAt.setDate(expiresAt.getDate() + config.valid_days_after);

        // Get tier for enhanced birthday benefits
        const account = Array.isArray(guest.loyalty_accounts)
            ? guest.loyalty_accounts[0]
            : guest.loyalty_accounts;
        const tier = account?.tier ?? 'bronze';
        const tierConfig = getTierConfig(tier);

        // Calculate bonus based on tier
        const bonusPoints = config.points_bonus * tierConfig.points_multiplier;
        const discountPct = config.discount_percentage ?? 10;

        // Create points bonus
        await db.from('loyalty_transactions').insert({
            restaurant_id: restaurantId,
            account_id: account?.id,
            points_delta: bonusPoints,
            balance_after: (account?.points_balance ?? 0) + bonusPoints,
            transaction_type: 'birthday_bonus',
            reason: `Birthday bonus (${tier} tier)`,
            metadata: { tier, base_bonus: config.points_bonus },
        });

        // Update points balance
        if (account?.id) {
            await db
                .from('loyalty_accounts')
                .update({
                    points_balance: account.points_balance + bonusPoints,
                    total_points_earned: account.total_points_earned + bonusPoints,
                })
                .eq('id', account.id);
        }

        // Create discount coupon
        const { data: _reward, error: rewardError } = await db
            .from('guest_rewards')
            .insert({
                restaurant_id: restaurantId,
                guest_id: guestId,
                reward_type: 'percentage_discount',
                reward_value: discountPct,
                name: `Birthday ${discountPct}% Off`,
                source: 'birthday',
                source_metadata: { tier, bonus_points: bonusPoints },
                expires_at: expiresAt.toISOString(),
                status: 'available',
            })
            .select(
                'id, restaurant_id, guest_id, reward_type, reward_value, name, source, expires_at, status, created_at'
            )
            .single();

        if (rewardError) {
            return { rewardCreated: false, error: rewardError.message };
        }

        return {
            rewardCreated: true,
            reward: {
                type: 'percentage_discount',
                value: discountPct,
                expiresAt: expiresAt.toISOString(),
            },
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { rewardCreated: false, error: errorMessage };
    }
}

/**
 * Get guests with upcoming birthdays (for marketing campaigns)
 */
export async function getUpcomingBirthdays(params: {
    supabase: SupabaseClient;
    restaurantId: string;
    daysAhead: number;
}): Promise<
    Array<{
        guest_id: string;
        birthday: string;
        days_until: number;
        tier: LoyaltyTier;
    }>
> {
    const { supabase, restaurantId, daysAhead } = params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Get all guests with birthdays set
        const { data: guests, error } = await db
            .from('guests')
            .select(
                `
                id,
                birthday,
                loyalty_accounts(tier)
            `
            )
            .eq('restaurant_id', restaurantId)
            .not('birthday', 'is', null);

        if (error) {
            return [];
        }

        const today = new Date();
        const results: Array<{
            guest_id: string;
            birthday: string;
            days_until: number;
            tier: LoyaltyTier;
        }> = [];

        for (const guest of guests ?? []) {
            if (!guest.birthday) continue;

            const birthday = new Date(guest.birthday);
            birthday.setFullYear(today.getFullYear());

            // If birthday has passed, check next year
            if (birthday < today) {
                birthday.setFullYear(today.getFullYear() + 1);
            }

            const daysUntil = Math.floor(
                (birthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysUntil <= daysAhead && daysUntil >= 0) {
                const account = Array.isArray(guest.loyalty_accounts)
                    ? guest.loyalty_accounts[0]
                    : guest.loyalty_accounts;

                results.push({
                    guest_id: guest.id,
                    birthday: guest.birthday,
                    days_until: daysUntil,
                    tier: account?.tier ?? 'bronze',
                });
            }
        }

        return results.sort((a, b) => a.days_until - b.days_until);
    } catch {
        return [];
    }
}

// =========================================================
// Points Calculation with Tier Multiplier
// =========================================================

/**
 * Calculate points earned for an order with tier multiplier
 */
export async function calculateOrderPoints(params: {
    supabase: SupabaseClient;
    restaurantId: string;
    guestId: string;
    orderTotal: number;
    programConfig?: LoyaltyProgramConfig;
}): Promise<{
    basePoints: number;
    tierMultiplier: number;
    totalPoints: number;
    tier: LoyaltyTier;
}> {
    const { supabase, restaurantId, guestId, orderTotal, programConfig } = params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // Get loyalty account
    const { data: account } = await db
        .from('loyalty_accounts')
        .select('tier')
        .eq('guest_id', guestId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    const tier = account?.tier ?? 'bronze';
    const tierConfig = getTierConfig(tier, programConfig?.tiers);

    // Calculate base points
    const pointsPerCurrency = programConfig?.points_per_currency_unit ?? 1;
    const currencyUnit = programConfig?.currency_unit ?? 1;
    const basePoints = Math.floor((orderTotal / currencyUnit) * pointsPerCurrency);

    // Apply tier multiplier
    const totalPoints = Math.floor(basePoints * tierConfig.points_multiplier);

    return {
        basePoints,
        tierMultiplier: tierConfig.points_multiplier,
        totalPoints,
        tier,
    };
}

/**
 * Award points for an order with tier multiplier
 */
export async function awardOrderPoints(params: {
    supabase: SupabaseClient;
    restaurantId: string;
    guestId: string;
    orderId: string;
    orderTotal: number;
    programConfig?: LoyaltyProgramConfig;
}): Promise<{
    success: boolean;
    pointsAwarded: number;
    newBalance: number;
    tier: LoyaltyTier;
    error?: string;
}> {
    const { supabase, restaurantId, guestId, orderId, orderTotal, programConfig } = params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Calculate points
        const pointsCalc = await calculateOrderPoints({
            supabase,
            restaurantId,
            guestId,
            orderTotal,
            programConfig,
        });

        // Get current account
        // HIGH-013: Explicit column selection
        const accountResult = await db
            .from('loyalty_accounts')
            .select(
                'id, guest_id, restaurant_id, points_balance, tier, total_visits, total_points_earned, status'
            )
            .eq('guest_id', guestId)
            .eq('restaurant_id', restaurantId)
            .maybeSingle();

        let account = accountResult.data;
        const accountError = accountResult.error;

        if (accountError) {
            return {
                success: false,
                pointsAwarded: 0,
                newBalance: 0,
                tier: 'bronze',
                error: accountError.message,
            };
        }

        if (!account) {
            // Create account
            const { data: newAccount, error: createError } = await db
                .from('loyalty_accounts')
                .insert({
                    restaurant_id: restaurantId,
                    guest_id: guestId,
                    points_balance: pointsCalc.totalPoints,
                    tier: 'bronze',
                    total_visits: 0,
                    total_points_earned: pointsCalc.totalPoints,
                    status: 'active',
                })
                // HIGH-013: Explicit column selection
                .select(
                    'id, guest_id, restaurant_id, points_balance, tier, total_visits, total_points_earned, status'
                )
                .single();

            if (createError) {
                return {
                    success: false,
                    pointsAwarded: 0,
                    newBalance: 0,
                    tier: 'bronze',
                    error: createError.message,
                };
            }
            account = newAccount;
        } else {
            // Update existing account
            const newBalance = account.points_balance + pointsCalc.totalPoints;
            const newTotalEarned = account.total_points_earned + pointsCalc.totalPoints;

            // Check for tier upgrade
            const newTier = calculateTier(newBalance, account.total_visits, programConfig?.tiers);

            await db
                .from('loyalty_accounts')
                .update({
                    points_balance: newBalance,
                    total_points_earned: newTotalEarned,
                    tier: newTier,
                })
                .eq('id', account.id);

            account.points_balance = newBalance;
            account.tier = newTier;
        }

        // Record transaction
        await db.from('loyalty_transactions').insert({
            restaurant_id: restaurantId,
            account_id: account.id,
            order_id: orderId,
            points_delta: pointsCalc.totalPoints,
            balance_after: account.points_balance,
            transaction_type: 'earn',
            reason: `Order points (${pointsCalc.tierMultiplier}x ${pointsCalc.tier} tier)`,
            metadata: {
                base_points: pointsCalc.basePoints,
                tier_multiplier: pointsCalc.tierMultiplier,
                order_total: orderTotal,
            },
        });

        return {
            success: true,
            pointsAwarded: pointsCalc.totalPoints,
            newBalance: account.points_balance,
            tier: account.tier,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            success: false,
            pointsAwarded: 0,
            newBalance: 0,
            tier: 'bronze',
            error: errorMessage,
        };
    }
}

// =========================================================
// Guest Rewards Management
// =========================================================

/**
 * Get available rewards for a guest
 */
export async function getAvailableRewards(params: {
    supabase: SupabaseClient;
    restaurantId: string;
    guestId: string;
}): Promise<
    Array<{
        id: string;
        name: string;
        type: string;
        value: number;
        expires_at: string;
        source: string;
    }>
> {
    const { supabase, restaurantId, guestId } = params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const now = new Date().toISOString();

    const { data, error } = await db
        .from('guest_rewards')
        .select('id, name, reward_type, reward_value, expires_at, source')
        .eq('restaurant_id', restaurantId)
        .eq('guest_id', guestId)
        .eq('status', 'available')
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false });

    if (error) {
        return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.reward_type,
        value: r.reward_value,
        expires_at: r.expires_at,
        source: r.source,
    }));
}

/**
 * Redeem a guest reward
 */
export async function redeemReward(params: {
    supabase: SupabaseClient;
    restaurantId: string;
    guestId: string;
    rewardId: string;
    orderId?: string;
}): Promise<{
    success: boolean;
    reward?: {
        type: string;
        value: number;
    };
    error?: string;
}> {
    const { supabase, restaurantId, guestId, rewardId, orderId } = params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Get the reward
        // HIGH-013: Explicit column selection
        const { data: reward, error: rewardError } = await db
            .from('guest_rewards')
            .select(
                'id, restaurant_id, guest_id, reward_type, reward_value, name, source, expires_at, status, created_at'
            )
            .eq('id', rewardId)
            .eq('restaurant_id', restaurantId)
            .eq('guest_id', guestId)
            .eq('status', 'available')
            .maybeSingle();

        if (rewardError) {
            return { success: false, error: rewardError.message };
        }

        if (!reward) {
            return { success: false, error: 'Reward not found or already redeemed' };
        }

        // Check expiration
        if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
            await db.from('guest_rewards').update({ status: 'expired' }).eq('id', rewardId);
            return { success: false, error: 'Reward has expired' };
        }

        // Mark as redeemed
        await db
            .from('guest_rewards')
            .update({
                status: 'redeemed',
                redeemed_at: new Date().toISOString(),
                order_id: orderId ?? null,
            })
            .eq('id', rewardId);

        return {
            success: true,
            reward: {
                type: reward.reward_type,
                value: reward.reward_value,
            },
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}
