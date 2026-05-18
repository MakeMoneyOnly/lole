/**
 * Business Constants
 *
 * Single source of truth for business logic constants.
 * @see SKILLS/productivity/reducing-entropy/SKILL.md
 */

// ============================================================================
// Currency
// ============================================================================

/** Santim (cents) per Ethiopian Birr */
export const SANTIM_PER_BIRR = 100;

/** Default hourly labor rate in ETB */
export const DEFAULT_HOURLY_LABOR_RATE_ETB = 50;

// ============================================================================
// Loyalty Tiers
// ============================================================================

export const LOYALTY_TIERS = {
    platinum: { minSpent: 100000, label: 'Platinum' },
    gold: { minSpent: 50000, label: 'Gold' },
    silver: { minSpent: 20000, label: 'Silver' },
    bronze: { minSpent: 0, label: 'Bronze' },
} as const;

export type LoyaltyTier = keyof typeof LOYALTY_TIERS;

/** Determine loyalty tier based on total spent */
export function getLoyaltyTier(totalSpent: number): LoyaltyTier {
    if (totalSpent >= LOYALTY_TIERS.platinum.minSpent) return 'platinum';
    if (totalSpent >= LOYALTY_TIERS.gold.minSpent) return 'gold';
    if (totalSpent >= LOYALTY_TIERS.silver.minSpent) return 'silver';
    return 'bronze';
}

// ============================================================================
// Pagination
// ============================================================================

export const PAGINATION = {
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 200,
    NOTIFICATION_QUEUE_LIMIT: 100,
} as const;

// ============================================================================
// Time Constants (in milliseconds)
// ============================================================================

export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
} as const;

// ============================================================================
// KDS Constants
// ============================================================================

export const KDS = {
    /** Auto-archive ready items after this many minutes */
    READY_AUTO_ARCHIVE_MINUTES: 15,
    /** Maximum retry attempts for realtime reconnection */
    MAX_RECONNECT_ATTEMPTS: 5,
    /** Base delay for exponential backoff (ms) */
    RECONNECT_BASE_DELAY_MS: 1000,
} as const;
