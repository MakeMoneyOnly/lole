/**
 * lole Subscription Plan Feature Definitions
 *
 * Based on enterprise architecture from Check.md and user requirements:
 * - Free: Digital Menu only (no POS, no orders) - for restaurants testing the system
 * - Starter: Full POS with basic features
 * - Pro: Full features + loyalty + gift cards
 * - Enterprise: Everything + channels + campaigns + multi-location
 */

export const PlanFeatures = {
    // Free: Digital Menu only - for restaurants testing the system
    // No POS, no orders, just a digital menu for guests to browse
    free: [
        'digital_menu', // Public menu page for guests
        'unlimited_tables', // Table management (view only)
        'menu_3_price_changes', // 3 price changes per month
        'qr_code_generation', // Generate QR codes for menu
    ] as const,

    // Starter: Full POS with basic features
    starter: [
        'digital_menu',
        'pos', // Waiter POS
        'ordering', // Order creation and management
        'unlimited_tables', // Full table management
        'staff_5', // Up to 5 staff members
        'kds_1', // 1 KDS station
        'analytics', // Basic analytics
        'reports', // Basic reports
    ] as const,

    // Pro: Full features + loyalty + gift cards
    pro: [
        'digital_menu',
        'pos',
        'ordering',
        'unlimited_tables',
        'unlimited_staff', // Unlimited staff members
        'kds_5', // 5 KDS stations
        'analytics',
        'reports',
        'loyalty', // Loyalty program
        'gift_cards', // Gift card system
    ] as const,

    // Enterprise: Everything + channels + campaigns + multi-location
    enterprise: [
        'digital_menu',
        'pos',
        'ordering',
        'unlimited_tables',
        'unlimited_staff',
        'kds_unlimited', // Unlimited KDS stations
        'analytics',
        'reports',
        'loyalty',
        'gift_cards',
        'channels', // Delivery partner integrations
        'campaigns', // SMS/Email/WhatsApp campaigns
        'advanced_analytics', // Advanced analytics and insights
        'multi_location', // Multiple restaurant locations
        'white_label', // White-label customization
        'sla', // Service level agreement
        'dedicated_support', // Dedicated support
    ] as const,
} as const;

export type PlanName = keyof typeof PlanFeatures;
export type PlanFeature = (typeof PlanFeatures)[PlanName][number];

/**
 * Check if a feature is available on a given plan
 */
export function hasFeature(plan: PlanName, feature: string): boolean {
    const planFeatures = PlanFeatures[plan];
    return (planFeatures as readonly string[]).includes(feature);
}

/**
 * Get all features available on a plan
 */
export function getPlanFeatures(plan: PlanName): readonly string[] {
    return PlanFeatures[plan];
}

/**
 * Check if a plan can have unlimited something
 */
export function getPlanLimit(plan: PlanName, resource: 'staff' | 'kds' | 'tables'): number {
    switch (resource) {
        case 'staff':
            if (plan === 'free') return 0; // No staff
            if (plan === 'starter') return 5;
            return -1; // Unlimited (-1 = unlimited)
        case 'kds':
            if (plan === 'free') return 0; // No KDS
            if (plan === 'starter') return 1;
            if (plan === 'pro') return 5;
            return -1; // Unlimited
        case 'tables':
            return -1; // All plans have unlimited tables
        default:
            return 0;
    }
}

/**
 * Subscription plan hierarchy (higher index = more features)
 */
export const PlanHierarchy: Record<PlanName, number> = {
    free: 0,
    starter: 1,
    pro: 2,
    enterprise: 3,
};

/**
 * Check if plan upgrade is needed for feature
 */
export function requiresUpgrade(currentPlan: PlanName, feature: string): boolean {
    for (const plan of ['free', 'starter', 'pro', 'enterprise'] as PlanName[]) {
        if ((PlanFeatures[plan] as readonly string[]).includes(feature)) {
            return PlanHierarchy[plan] > PlanHierarchy[currentPlan];
        }
    }
    return true;
}

/**
 * Get the next upgrade plan from current plan
 */
export function getNextUpgradePlan(currentPlan: PlanName): PlanName | null {
    const upgrades: Record<PlanName, PlanName | null> = {
        free: 'starter',
        starter: 'pro',
        pro: 'enterprise',
        enterprise: null,
    };
    return upgrades[currentPlan];
}

/**
 * Plan pricing in ETB (Ethiopian Birr)
 */
export const PlanPricing = {
    free: {
        monthly: 0,
        annual: 0,
        description: 'Digital Menu - perfect for testing',
    },
    starter: {
        monthly: 800,
        annual: 8000, // ~2 months free
        description: 'Full POS for small restaurants',
    },
    pro: {
        monthly: 1200,
        annual: 12000, // ~2 months free
        description: 'Full features + loyalty + gift cards',
    },
    enterprise: {
        monthly: 5000, // Starting price, negotiable
        annual: 50000,
        description: 'Multi-location + campaigns + SLA',
    },
} as const;

/**
 * Feature gate descriptions for UI
 */
export const FeatureDescriptions: Record<PlanFeature, string> = {
    // Free features
    digital_menu: 'Digital Menu - public menu page for guests to browse',
    unlimited_tables: 'Unlimited table management',
    menu_3_price_changes: '3 price changes per month',
    qr_code_generation: 'Generate QR codes linking to your menu',

    // Starter features
    pos: 'Waiter POS - take orders on tablet',
    ordering: 'Order creation and management',
    staff_5: 'Up to 5 staff members',
    kds_1: '1 Kitchen Display System station',
    analytics: 'Basic analytics and insights',
    reports: 'Basic reporting',

    // Pro features
    unlimited_staff: 'Unlimited staff members',
    kds_5: '5 Kitchen Display System stations',
    loyalty: 'Loyalty points program',
    gift_cards: 'Gift card system',

    // Enterprise features
    channels: 'Delivery partner integrations',
    campaigns: 'SMS/Email/WhatsApp marketing campaigns',
    advanced_analytics: 'Advanced analytics and AI insights',
    multi_location: 'Manage multiple restaurant locations',
    white_label: 'White-label customization',
    sla: 'Service Level Agreement',
    dedicated_support: 'Dedicated support team',
    kds_unlimited: 'Unlimited KDS stations',
};
