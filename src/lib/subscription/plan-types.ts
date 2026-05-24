/**
 * Subscription Plan Types
 * Defines plan levels and feature availability for lole subscription system
 */

export type PlanLevel = 'free' | 'pro' | 'enterprise';

/**
 * Plan feature definitions - which features are available at each plan level
 */
export const PlanFeatures: Record<PlanLevel, readonly string[]> = {
    free: ['basic_menu', 'basic_orders', 'basic_tables', 'basic_staff', 'qr_ordering'],
    pro: [
        'basic_menu',
        'basic_orders',
        'basic_tables',
        'basic_staff',
        'qr_ordering',
        'analytics',
        'inventory',
        'channels',
        'guests_directory',
        'loyalty_program',
        'gift_cards',
        'marketing_campaigns',
        'advanced_reports',
        'delivery_integration',
        'scheduled_reports',
        'happy_hour_pricing',
        'discount_engine',
        'tip_pooling',
    ],
    enterprise: [
        'basic_menu',
        'basic_orders',
        'basic_tables',
        'basic_staff',
        'qr_ordering',
        'analytics',
        'inventory',
        'channels',
        'guests_directory',
        'loyalty_program',
        'gift_cards',
        'marketing_campaigns',
        'advanced_reports',
        'delivery_integration',
        'scheduled_reports',
        'happy_hour_pricing',
        'discount_engine',
        'tip_pooling',
        'multi_location',
        'api_access',
        'custom_integrations',
        'priority_support',
        'dedicated_account_manager',
    ],
} as const;

/**
 * Plan pricing information (in Ethiopian Birr - ETB)
 */
export const PlanPricing: Record<PlanLevel, { monthly: number; yearly: number }> = {
    free: {
        monthly: 0,
        yearly: 0,
    },
    pro: {
        monthly: 2999,
        yearly: 29990,
    },
    enterprise: {
        monthly: 9999,
        yearly: 99990,
    },
};

/**
 * Feature descriptions for UI display
 */
export const FeatureDescriptions: Record<string, { name: string; description: string }> = {
    analytics: {
        name: 'Analytics Dashboard',
        description: 'View sales trends, popular items, and revenue reports',
    },
    inventory: {
        name: 'Inventory Management',
        description: 'Track ingredients, recipes, and stock levels',
    },
    channels: {
        name: 'Delivery Channels',
        description: 'Connect with delivery partners like Deliverr and others',
    },
    guests_directory: {
        name: 'Guest Directory',
        description: 'Manage customer profiles and contact information',
    },
    loyalty_program: {
        name: 'Loyalty Program',
        description: 'Create and manage customer loyalty points',
    },
    gift_cards: {
        name: 'Gift Cards',
        description: 'Sell and redeem digital gift cards',
    },
    marketing_campaigns: {
        name: 'Marketing Campaigns',
        description: 'Send SMS and email campaigns to customers',
    },
    advanced_reports: {
        name: 'Advanced Reports',
        description: 'Detailed financial and operational reports',
    },
    delivery_integration: {
        name: 'Delivery Integration',
        description: 'Integrate with delivery service providers',
    },
    scheduled_reports: {
        name: 'Scheduled Reports',
        description: 'Automate daily, weekly, or monthly report delivery',
    },
    happy_hour_pricing: {
        name: 'Happy Hour Pricing',
        description: 'Set time-based pricing variations',
    },
    discount_engine: {
        name: 'Discount Engine',
        description: 'Create and apply discounts and promotions',
    },
    tip_pooling: {
        name: 'Tip Pooling',
        description: 'Automatically distribute tips to staff',
    },
    multi_location: {
        name: 'Multi-Location',
        description: 'Manage multiple restaurant locations',
    },
    api_access: {
        name: 'API Access',
        description: 'Programmatic access to your data',
    },
    custom_integrations: {
        name: 'Custom Integrations',
        description: 'Custom third-party integrations',
    },
    priority_support: {
        name: 'Priority Support',
        description: 'Get faster response times from support',
    },
    dedicated_account_manager: {
        name: 'Dedicated Account Manager',
        description: 'Personal account manager for your business',
    },
};

/**
 * Get plan tier order for comparison
 */
export function getPlanTier(plan: PlanLevel): number {
    const tiers: Record<PlanLevel, number> = {
        free: 0,
        pro: 1,
        enterprise: 2,
    };
    return tiers[plan] ?? 0;
}

/**
 * Get the next plan up from current plan
 */
export function getNextPlan(currentPlan: PlanLevel): PlanLevel | null {
    const upgrades: Record<PlanLevel, PlanLevel | null> = {
        free: 'pro',
        pro: 'enterprise',
        enterprise: null,
    };
    return upgrades[currentPlan];
}
