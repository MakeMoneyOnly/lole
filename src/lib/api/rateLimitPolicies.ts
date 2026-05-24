export type RouteRateLimitPolicy = {
    windowMs: number;
    maxRequests: number;
};

export const API_RATE_LIMIT_POLICIES: Record<string, RouteRateLimitPolicy> = {
    // Merchant Operations
    '/api/v1/merchant/operations/orders': { windowMs: 60_000, maxRequests: 80 },
    '/api/v1/merchant/operations/orders/': { windowMs: 60_000, maxRequests: 100 },
    '/api/v1/merchant/operations/service-requests': { windowMs: 60_000, maxRequests: 60 },
    '/api/v1/merchant/operations/kds/queue': { windowMs: 60_000, maxRequests: 180 },
    '/api/v1/merchant/operations/kds/telemetry': { windowMs: 60_000, maxRequests: 180 },
    '/api/v1/merchant/operations/kds/items/': { windowMs: 60_000, maxRequests: 220 },
    '/api/v1/merchant/operations/kds/orders/': { windowMs: 60_000, maxRequests: 180 },
    '/api/v1/merchant/operations/payments/initiate': { windowMs: 60_000, maxRequests: 40 },
    '/api/v1/merchant/operations/payments/verify': { windowMs: 60_000, maxRequests: 60 },
    '/api/v1/merchant/operations/payments/providers/health': { windowMs: 60_000, maxRequests: 40 },

    // Merchant Core
    '/api/v1/merchant/core/command-center': { windowMs: 60_000, maxRequests: 120 },
    '/api/v1/merchant/core/settings/kds': { windowMs: 60_000, maxRequests: 60 },
    '/api/v1/merchant/core/staff/schedule': { windowMs: 60_000, maxRequests: 80 },
    '/api/v1/merchant/core/staff/time-entries/clock': { windowMs: 60_000, maxRequests: 80 },
    '/api/v1/merchant/core/dashboard-presets': { windowMs: 60_000, maxRequests: 60 },

    // Merchant Marketing
    '/api/v1/merchant/marketing/channels/summary': { windowMs: 60_000, maxRequests: 100 },
    '/api/v1/merchant/marketing/channels/online-ordering/settings': {
        windowMs: 60_000,
        maxRequests: 60,
    },
    '/api/v1/merchant/marketing/channels/delivery/connect': { windowMs: 60_000, maxRequests: 30 },
    '/api/v1/merchant/marketing/channels/delivery/orders': { windowMs: 60_000, maxRequests: 80 },
    '/api/v1/merchant/marketing/channels/delivery/orders/': { windowMs: 60_000, maxRequests: 60 },
    '/api/v1/merchant/marketing/loyalty/programs': { windowMs: 60_000, maxRequests: 60 },
    '/api/v1/merchant/marketing/loyalty/accounts/': { windowMs: 60_000, maxRequests: 60 },
    '/api/v1/merchant/marketing/gift-cards': { windowMs: 60_000, maxRequests: 60 },
    '/api/v1/merchant/marketing/gift-cards/': { windowMs: 60_000, maxRequests: 60 },
    '/api/v1/merchant/marketing/campaigns': { windowMs: 60_000, maxRequests: 60 },
    '/api/v1/merchant/marketing/campaigns/': { windowMs: 60_000, maxRequests: 60 },

    // Merchant Comms
    '/api/v1/merchant/comms/support/tickets': { windowMs: 60_000, maxRequests: 30 },

    // POS / Device
    '/api/v1/pos/device/tables/ensure-open-session': { windowMs: 60_000, maxRequests: 100 },
    '/api/v1/pos/device/tables/bill-request': { windowMs: 60_000, maxRequests: 80 },
    '/api/v1/pos/device/tables/close': { windowMs: 60_000, maxRequests: 60 },

    // Internal
    '/api/v1/internal/alerts/rules': { windowMs: 60_000, maxRequests: 60 },
    '/api/v1/internal/alerts/rules/': { windowMs: 60_000, maxRequests: 60 },
};

export const DEFAULT_API_RATE_LIMIT_POLICY: RouteRateLimitPolicy = {
    windowMs: 60_000,
    maxRequests: 100,
};

export function resolveRateLimitPolicy(pathname: string): RouteRateLimitPolicy {
    const exact = API_RATE_LIMIT_POLICIES[pathname];
    if (exact) {
        return exact;
    }

    // Prefix fallback for dynamic nested routes.
    const prefix = Object.keys(API_RATE_LIMIT_POLICIES).find(
        key => key.endsWith('/') && pathname.startsWith(key)
    );
    if (prefix) {
        return API_RATE_LIMIT_POLICIES[prefix];
    }

    return DEFAULT_API_RATE_LIMIT_POLICY;
}
