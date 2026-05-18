import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { Database } from '@/types/database';
import {
    isE2EBypassAllowed,
    isValidE2EBypassSecret,
    logE2ESecurityEvent,
} from '@/lib/security/e2e-validation';

export async function createClient() {
    const cookieStore = await cookies();
    const headersList = await headers();

    // =========================================================
    // CRIT-003: Secure E2E Test Bypass
    // =========================================================
    // SECURITY: Check if E2E bypass is allowed in current environment
    // This is the FIRST check - if not allowed, skip all bypass logic
    // =========================================================

    let isE2EBypass = false;

    if (!isE2EBypassAllowed()) {
        // In production, log any bypass attempts for security monitoring
        const e2eBypassAuth = headersList.get('x-e2e-bypass-auth');
        const e2eBypassSecret = headersList.get('x-e2e-bypass-secret');
        const cookieToken = cookieStore.get('sb-access-token')?.value;

        if (e2eBypassAuth === '1' || e2eBypassSecret || cookieToken?.startsWith('e2e-mock-')) {
            logE2ESecurityEvent('bypass_attempt', {
                source: 'server',
                hasHeaderAuth: !!e2eBypassAuth,
                hasHeaderSecret: !!e2eBypassSecret,
                hasCookieToken: !!cookieToken,
            });
        }
        // Continue to normal Supabase client - E2E bypass is NOT available
    } else {
        // E2E bypass is allowed in this environment (non-production with E2E_TEST_MODE=true)
        const configuredSecret = process.env.E2E_BYPASS_SECRET;

        // SECURITY: Require configured secret - NO default fallback
        if (!configuredSecret || configuredSecret === '') {
            logE2ESecurityEvent('config_warning', {
                source: 'server',
                reason: 'E2E_BYPASS_SECRET not configured',
            });
        } else {
            // Check for header-based bypass (set by Playwright via setExtraHTTPHeaders)
            const e2eBypassAuth = headersList.get('x-e2e-bypass-auth');
            const e2eBypassSecret = headersList.get('x-e2e-bypass-secret');
            const hasValidHeaderBypass =
                e2eBypassAuth === '1' && isValidE2EBypassSecret(e2eBypassSecret ?? undefined);

            // Check for cookie-based bypass (set by middleware on subsequent requests)
            const cookieValue = cookieStore.get('sb-access-token')?.value;
            const expectedCookieValue = `e2e-mock-access-token:${configuredSecret}`;
            const hasValidCookieBypass = cookieValue === expectedCookieValue;

            // E2E bypass is active if either header or cookie bypass is valid
            isE2EBypass = hasValidHeaderBypass || hasValidCookieBypass;

            // Log when E2E bypass is active
            if (isE2EBypass) {
                logE2ESecurityEvent('bypass_success', {
                    source: 'server',
                    method: hasValidHeaderBypass ? 'header' : 'cookie',
                });
            }
        }
    }

    // Get and clean environment variables
    // Vercel can store values with extra quotes and \r\n when set via CLI/API
    // e.g. '"actual-value" \r\n' — we need to strip all of that
    const cleanEnvVar = (val: string | undefined): string => {
        if (!val) return '';
        return val
            .replace(/\r/g, '') // carriage returns
            .replace(/\n/g, '') // newlines
            .replace(/^["']+/, '') // leading quotes (one or more)
            .replace(/["']+$/, '') // trailing quotes (one or more)
            .trim();
    };

    const supabaseUrl = cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL);
    const supabaseKey = cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    // If environment variables are missing or are placeholder values, return a mock client
    // When real credentials are available (like in .env), use the real Supabase client
    // E2E bypass via cookie is still supported for authenticated sessions in E2E tests
    const isPlaceholderUrl = supabaseUrl?.includes('placeholder') || !supabaseUrl;
    const isPlaceholderKey = supabaseKey === 'placeholder-key' || !supabaseKey;
    const hasRealCredentials = supabaseUrl && supabaseKey && !isPlaceholderUrl && !isPlaceholderKey;

    // Use mock client when:
    // 1. E2E bypass cookie is set (middleware set this from headers)
    // 2. No credentials at all
    // 3. Placeholder values (E2E tests without real backend)
    // NOTE: E2E bypass cookie takes priority over real credentials
    // This ensures E2E tests have predictable mocked data
    if (isE2EBypass || !hasRealCredentials) {
        // Helper to create chainable mock methods.
        // NOTE: data is the list-level result; maybeSingle returns null (no row found)
        // unless overridden by a table-specific mock below.
        const createChainableMock = (data: unknown, singleData: unknown = null): any => ({
            data,
            error: null,
            eq: function () {
                return this;
            },
            neq: function () {
                return this;
            },
            gt: function () {
                return this;
            },
            gte: function () {
                return this;
            },
            lt: function () {
                return this;
            },
            lte: function () {
                return this;
            },
            like: function () {
                return this;
            },
            ilike: function () {
                return this;
            },
            is: function () {
                return this;
            },
            in: function () {
                return this;
            },
            contains: function () {
                return this;
            },
            containedBy: function () {
                return this;
            },
            overlaps: function () {
                return this;
            },
            or: function () {
                return this;
            },
            order: function () {
                return this;
            },
            limit: function () {
                return this;
            },
            range: function () {
                return this;
            },
            single: async () => ({ data: singleData, error: null }),
            maybeSingle: async () => ({ data: singleData, error: null }),
            then: function (resolve: (value: unknown) => void) {
                return resolve({ data, error: null, count: null });
            },
        });

        // E2E mock restaurant_staff row — satisfies resolveRestaurantId()
        // Must include user_id to match the query: .eq('user_id', user.id)
        const e2eStaffRow = {
            user_id: 'staff-user-1',
            restaurant_id: 'rest-1',
            role: 'owner',
            is_active: true,
        };

        // E2E mock restaurant row — contains all fields accessed by settings/dashboard routes
        // so that .single() calls on the restaurants table never return null.
        const e2eRestaurantRow = {
            id: 'rest-1',
            name: 'Saba Grill',
            slug: 'saba-grill',
            // JSONB settings blob covering security, notifications, dashboard, channels, etc.
            settings: {
                security: {
                    require_mfa: false,
                    session_timeout_minutes: 120,
                    allowed_ip_ranges: [],
                    alert_on_suspicious_login: true,
                },
                notifications: {
                    email_enabled: true,
                    sms_enabled: false,
                    in_app_enabled: true,
                    escalation_enabled: true,
                    escalation_minutes: 15,
                },
                channels: {
                    online_ordering: {
                        enabled: true,
                        accepts_scheduled_orders: true,
                        auto_accept_orders: false,
                        prep_time_minutes: 30,
                        max_daily_orders: 300,
                        service_hours: { start: '08:00', end: '22:00' },
                        order_throttling_enabled: false,
                        throttle_limit_per_15m: 40,
                    },
                },
                dashboard_preset: null,
                zones: [],
                kds: {},
            },
            // Chapa payment fields (used by the Settings page server component)
            chapa_settlement_bank_code: '',
            chapa_settlement_bank_name: '',
            chapa_settlement_account_name: '',
            chapa_settlement_account_number_masked: '',
            chapa_subaccount_status: 'not_configured',
            chapa_subaccount_id: null,
            chapa_subaccount_last_error: null,
            chapa_subaccount_provisioned_at: null,
            hosted_checkout_fee_percentage: 0.03,
        };

        // E2E mock orders for dashboard attention queue
        const e2eOrders = [
            {
                id: 'order-1',
                order_number: 'ORD-1001',
                table_number: 'T1',
                status: 'pending',
                created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
                completed_at: null,
                total_price: 420,
                notes: 'No onions',
            },
            {
                id: 'order-2',
                order_number: 'ORD-1002',
                table_number: 'T3',
                status: 'preparing',
                created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString(),
                completed_at: null,
                total_price: 315,
                notes: null,
            },
        ];

        // E2E mock service requests
        const e2eServiceRequests = [
            {
                id: 'req-1',
                table_number: 'T2',
                status: 'pending',
                request_type: 'water',
                notes: 'Sparkling water',
                created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
            },
        ];

        // E2E mock tables
        const e2eTables = [
            { id: 'table-1', table_number: 'T1', status: 'occupied', capacity: 4, is_active: true },
            {
                id: 'table-2',
                table_number: 'T2',
                status: 'available',
                capacity: 2,
                is_active: true,
            },
            { id: 'table-3', table_number: 'T3', status: 'occupied', capacity: 4, is_active: true },
        ];

        // E2E mock guests for guests directory
        const e2eGuests = [
            {
                id: 'guest-1',
                name: 'Selam Guest',
                phone: '+251911123456',
                language: 'en',
                tags: ['vip', 'regular'],
                is_vip: true,
                visit_count: 15,
                lifetime_value: 12500,
                first_seen_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                last_seen_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
                id: 'guest-2',
                name: 'Abebe Bekele',
                phone: '+251922234567',
                language: 'am',
                tags: ['regular'],
                is_vip: false,
                visit_count: 5,
                lifetime_value: 3200,
                first_seen_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                last_seen_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
        ];

        // E2E mock delivery partners for channels page
        const e2eDeliveryPartners = [
            {
                id: 'partner-1',
                provider: 'BEU',
                status: 'active',
                updated_at: new Date().toISOString(),
                last_sync_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];

        // E2E mock external orders for channels page
        const e2eExternalOrders = [
            {
                id: 'ext-order-1',
                provider: 'BEU',
                provider_order_id: 'BEU-1001',
                normalized_status: 'pending',
                total_amount: 850,
                currency: 'ETB',
                acknowledged_at: null,
                created_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            },
        ];

        // E2E mock payments for finance page
        const e2ePayments = [
            {
                id: 'pay-1',
                amount: 1200,
                currency: 'ETB',
                method: 'telebirr',
                status: 'captured',
                created_at: new Date().toISOString(),
                order_id: 'order-1',
            },
            {
                id: 'pay-2',
                amount: 800,
                currency: 'ETB',
                method: 'cash',
                status: 'captured',
                created_at: new Date().toISOString(),
                order_id: 'order-2',
            },
        ];

        // E2E mock payouts for finance page
        const e2ePayouts = [
            {
                id: 'payout-1',
                net: 7760,
                currency: 'ETB',
                status: 'processing',
                created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                paid_at: null,
            },
        ];

        // E2E mock reconciliation entries for finance page
        const e2eReconciliation = [
            {
                id: 'recon-1',
                created_at: new Date().toISOString(),
                expected_amount: 7760,
                settled_amount: 7600,
                delta_amount: -160,
                status: 'exception',
            },
        ];

        // E2E mock refunds for finance page
        const e2eRefunds = [
            {
                id: 'refund-1',
                amount: 120,
                status: 'pending',
                reason: 'Item unavailable',
                created_at: new Date().toISOString(),
                provider_reference: null,
            },
        ];

        // E2E mock categories for menu page
        const e2eCategories = [
            {
                id: 'cat-1',
                restaurant_id: 'rest-1',
                name: 'Mains',
                name_am: 'ዋና ምግቦች',
                section: null,
                order_index: 0,
                items: [
                    {
                        id: 'item-1',
                        category_id: 'cat-1',
                        name: 'Doro Wot',
                        price: 45000,
                        description: 'Spicy chicken stew',
                        is_available: true,
                        image_url: null,
                    },
                ],
            },
        ];

        // E2E mock menu items
        const e2eMenuItems = [
            {
                id: 'item-1',
                category_id: 'cat-1',
                name: 'Doro Wot',
                price: 450,
                description: 'Spicy chicken stew',
                is_available: true,
                image_url: null,
            },
        ];

        // E2E mock alert events
        const e2eAlertEvents = [
            {
                id: 'alert-1',
                entity_type: 'kitchen',
                entity_id: 'kitchen-1',
                status: 'open',
                severity: 'high',
                created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
                resolved_at: null,
            },
        ];

        const updateChainable = {
            data: null,
            error: null,
            eq: function () {
                return this;
            },
        };

        // Helper to get the right mock data for each table
        const getTableMockData = (
            tableName: string
        ): { listData: unknown[]; singleData: unknown } => {
            switch (tableName) {
                case 'restaurant_staff':
                    return { listData: [e2eStaffRow], singleData: e2eStaffRow };
                case 'restaurants':
                    return { listData: [e2eRestaurantRow], singleData: e2eRestaurantRow };
                case 'orders':
                    return { listData: e2eOrders, singleData: e2eOrders[0] };
                case 'service_requests':
                    return { listData: e2eServiceRequests, singleData: e2eServiceRequests[0] };
                case 'tables':
                    return { listData: e2eTables, singleData: e2eTables[0] };
                case 'guests':
                    return { listData: e2eGuests, singleData: e2eGuests[0] };
                case 'delivery_partners':
                    return { listData: e2eDeliveryPartners, singleData: e2eDeliveryPartners[0] };
                case 'external_orders':
                    return { listData: e2eExternalOrders, singleData: e2eExternalOrders[0] };
                case 'payments':
                    return { listData: e2ePayments, singleData: e2ePayments[0] };
                case 'payouts':
                    return { listData: e2ePayouts, singleData: e2ePayouts[0] };
                case 'reconciliation_entries':
                    return { listData: e2eReconciliation, singleData: e2eReconciliation[0] };
                case 'refunds':
                    return { listData: e2eRefunds, singleData: e2eRefunds[0] };
                case 'categories':
                    return { listData: e2eCategories, singleData: e2eCategories[0] };
                case 'menu_items':
                    return { listData: e2eMenuItems, singleData: e2eMenuItems[0] };
                case 'alert_events':
                    return { listData: e2eAlertEvents, singleData: e2eAlertEvents[0] };
                default:
                    return { listData: [], singleData: null };
            }
        };

        return {
            auth: {
                getUser: async () => ({
                    data: {
                        user: {
                            id: 'staff-user-1',
                            email: 'e2e@example.com',
                            aud: 'authenticated',
                            role: 'authenticated',
                        },
                    },
                    error: null,
                }),
                getSession: async () => ({
                    data: {
                        session: {
                            access_token: 'e2e-mock-access-token',
                            refresh_token: 'e2e-mock-refresh-token',
                            expires_in: 3600,
                            expires_at: 2099999999,
                            user: {
                                id: 'staff-user-1',
                                email: 'e2e@example.com',
                            },
                        },
                    },
                    error: null,
                }),
            },
            from: (table: string) => {
                const { listData, singleData } = getTableMockData(table);
                return {
                    // Return appropriate mock data for each table
                    select: () => createChainableMock(listData, singleData),
                    insert: () => ({ data: null, error: null }),
                    update: () => updateChainable,
                    delete: () => ({ data: null, error: null }),
                };
            },
        } as unknown as ReturnType<typeof createServerClient<Database>>;
    }

    return createServerClient<Database>(supabaseUrl, supabaseKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    );
                } catch {
                    // The `setAll` method was called from a Server Component.
                    // This can be ignored if you have middleware refreshing
                    // user sessions.
                }
            },
        },
        // Supabase client configuration
        db: {
            schema: 'public',
        },
    });
}
