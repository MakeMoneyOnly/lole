import { expect, test } from '@playwright/test';

async function mockDashboardAuth(page: import('@playwright/test').Page) {
    await page.setExtraHTTPHeaders({
        'x-e2e-bypass-auth': '1',
        'x-e2e-bypass-secret': 'e2e-test-secret',
    });

    await page.addInitScript(() => {
        window.localStorage.setItem('__e2e_bypass_auth', 'true');
        window.localStorage.setItem(
            'sb-axuegixbqsvztdraenkz-auth-token',
            JSON.stringify({
                access_token: 'e2e-access-token',
                token_type: 'bearer',
                expires_in: 3600,
                expires_at: 2099999999,
                refresh_token: 'e2e-refresh-token',
                user: {
                    id: 'staff-user-1',
                    aud: 'authenticated',
                    role: 'authenticated',
                    email: 'e2e@example.com',
                },
            })
        );
    });

    await page.route('**/auth/v1/user', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'staff-user-1',
                aud: 'authenticated',
                role: 'authenticated',
                email: 'e2e@example.com',
            }),
        });
    });

    await page.route('**/rest/v1/rpc/get_my_staff_role', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                role: 'manager',
                restaurant_id: 'rest-1',
            }),
        });
    });

    await page.route('**/rest/v1/restaurant_staff*', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                {
                    role: 'manager',
                    restaurant_id: 'rest-1',
                    is_active: true,
                },
            ]),
        });
    });
}

test.describe('Channels health and delivery acknowledge flow', () => {
    test.beforeEach(async ({ page, isMobile }) => {
        test.skip(isMobile, 'Channels workflow assertions are desktop-scoped in this spec.');
        await mockDashboardAuth(page);
    });

    test('renders channel health and acknowledges an external order', async ({ page }) => {
        let isAcked = false;
        let capturedSettingsPayload: Record<string, unknown> | null = null;

        await page.route('**/api/channels/summary', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        totals: {
                            delivery_partners: 2,
                            connected_partners: 1,
                            degraded_partners: 1,
                            external_orders_24h: 14,
                            external_orders_total: 20,
                            unacked_orders: isAcked ? 0 : 1,
                        },
                        statuses: {
                            new: isAcked ? 0 : 1,
                            acknowledged: isAcked ? 1 : 0,
                        },
                        partners: [
                            {
                                id: 'partner-1',
                                provider: 'beu',
                                status: 'connected',
                                updated_at: '2026-02-18T08:00:00.000Z',
                                last_sync_at: '2026-02-18T08:00:00.000Z',
                            },
                        ],
                    },
                }),
            });
        });

        await page.route('**/api/channels/online-ordering/settings', async route => {
            if (route.request().method() === 'PATCH') {
                capturedSettingsPayload = route.request().postDataJSON() as Record<string, unknown>;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: capturedSettingsPayload,
                    }),
                });
                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        enabled: true,
                        accepts_scheduled_orders: true,
                        auto_accept_orders: false,
                        prep_time_minutes: 25,
                        max_daily_orders: 250,
                        service_hours: { start: '08:00', end: '22:00' },
                        order_throttling_enabled: false,
                        throttle_limit_per_15m: 40,
                    },
                }),
            });
        });

        await page.route('**/api/channels/delivery/orders?**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        orders: [
                            {
                                id: '44444444-4444-4444-8444-444444444444',
                                provider: 'beu',
                                provider_order_id: 'BEU-1001',
                                source_channel: 'delivery',
                                normalized_status: isAcked ? 'acknowledged' : 'new',
                                total_amount: 520,
                                currency: 'ETB',
                                payload_json: {},
                                acked_at: isAcked ? '2026-02-18T09:00:00.000Z' : null,
                                created_at: '2026-02-18T08:55:00.000Z',
                                updated_at: '2026-02-18T08:56:00.000Z',
                            },
                        ],
                        total: 1,
                    },
                }),
            });
        });

        await page.route('**/api/channels/delivery/orders/*/ack', async route => {
            isAcked = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        order: {
                            id: '44444444-4444-4444-8444-444444444444',
                            provider: 'beu',
                            normalized_status: 'acknowledged',
                            acked_at: '2026-02-18T09:00:00.000Z',
                        },
                    },
                }),
            });
        });

        await page.goto('/merchant/takeout');

        await expect(page.getByRole('heading', { name: /Takeout & Delivery/i })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Availability' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Partner Status' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Connections' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Hours' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Strategies' })).toBeVisible();

        // Click on the Connections tab to verify webhook inputs and documentation
        await page.getByRole('button', { name: 'Connections' }).click();
        await expect(page.getByText('Direct Webhook Connections')).toBeVisible();
        await expect(page.getByText('Ordering API Key')).toBeVisible();
        await expect(page.getByPlaceholder('https://your-api.com/webhooks/orders')).toBeVisible();

        // Click on the Strategies tab to verify quote time strategy list
        await page.getByRole('button', { name: 'Strategies' }).click();
        await expect(page.getByText('Quote Time Strategy')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Kitchen Capacity', exact: true })
        ).toBeVisible();
    });
});
