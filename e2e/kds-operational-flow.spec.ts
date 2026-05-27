import { expect, test } from '@playwright/test';

async function mockKdsAuth(page: import('@playwright/test').Page) {
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

test.describe('KDS queue to handoff flow', () => {
    test.beforeEach(async ({ page, isMobile }) => {
        test.skip(isMobile, 'KDS throughput workflow assertions are desktop-scoped in this spec.');
        await mockKdsAuth(page);
    });

    test('ingests queue, runs station prep, and completes expeditor handoff', async ({ page }) => {
        let itemStatus: 'queued' | 'in_progress' | 'ready' = 'queued';
        let served = false;

        await page.route('**/api/settings/kds', async route => {
            if (route.request().method() === 'PATCH') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: {
                            ready_auto_archive_minutes: 15,
                            alert_policy: {
                                new_ticket_sound: true,
                                sla_breach_visual: true,
                                recall_visual: true,
                                quiet_hours_enabled: false,
                                quiet_hours_start: '23:00',
                                quiet_hours_end: '06:00',
                            },
                        },
                    }),
                });
                return;
            }

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        ready_auto_archive_minutes: 15,
                        alert_policy: {
                            new_ticket_sound: true,
                            sla_breach_visual: true,
                            recall_visual: true,
                            quiet_hours_enabled: false,
                            quiet_hours_start: '23:00',
                            quiet_hours_end: '06:00',
                        },
                    },
                }),
            });
        });

        await page.route('**/api/kds/telemetry', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ data: { received: true } }),
                });
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        generated_at: new Date().toISOString(),
                        queue_lag: {
                            active_tickets: 1,
                            avg_minutes: 8,
                            p50_minutes: 8,
                            p95_minutes: 8,
                            max_minutes: 8,
                        },
                        sla: {
                            threshold_minutes: 30,
                            breached_tickets: 0,
                            breached_ratio_percent: 0,
                        },
                        websocket: {
                            status: 'healthy',
                            healthy: true,
                            last_heartbeat_at: new Date().toISOString(),
                            connected_stations: ['kitchen'],
                            samples_in_window: 2,
                        },
                    },
                }),
            });
        });

        await page.route('**/api/kds/queue*', async route => {
            const url = new URL(route.request().url());
            const station = url.searchParams.get('station');
            const createdAt = new Date(Date.now() - 8 * 60_000).toISOString();

            if (served) {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: {
                            orders: [],
                            total: 0,
                            summary: {
                                dineIn: 0,
                                directDelivery: 0,
                                directPickup: 0,
                                partners: 0,
                            },
                            cursor: {
                                next: null,
                                has_more: false,
                            },
                            filters: {
                                station,
                                sla_status: null,
                                sla_minutes: 30,
                                status: null,
                            },
                            policies: {
                                ready_auto_archive_minutes: 15,
                                auto_archived_in_this_fetch: 0,
                            },
                        },
                    }),
                });
                return;
            }

            const stationItems =
                station === 'expeditor'
                    ? [
                          {
                              id: 'item-1',
                              kds_item_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                              name: 'Burger',
                              quantity: 1,
                              station: 'kitchen',
                              status: itemStatus,
                          },
                      ]
                    : [
                          {
                              id: 'item-1',
                              kds_item_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                              name: 'Burger',
                              quantity: 1,
                              station: 'kitchen',
                              status: itemStatus,
                          },
                      ];

            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        orders: [
                            {
                                id: 'order-1',
                                source: 'dine-in',
                                sourceLabel: 'Dine In',
                                sourceColor: '#DC2626',
                                orderNumber: 'ORD-1001',
                                tableNumber: '12',
                                items: stationItems,
                                station: 'kitchen',
                                status: itemStatus === 'ready' ? 'ready' : 'preparing',
                                priority: 'normal',
                                createdAt,
                                elapsedMinutes: 8,
                                slaStatus: 'on_track',
                            },
                        ],
                        total: 1,
                        summary: {
                            dineIn: 1,
                            directDelivery: 0,
                            directPickup: 0,
                            partners: 0,
                        },
                        cursor: {
                            next: null,
                            has_more: false,
                        },
                        filters: {
                            station,
                            sla_status: null,
                            sla_minutes: 30,
                            status: null,
                        },
                        policies: {
                            ready_auto_archive_minutes: 15,
                            auto_archived_in_this_fetch: 0,
                        },
                    },
                }),
            });
        });

        await page.route('**/api/kds/items/*/action', async route => {
            const payload = route.request().postDataJSON() as { action?: string };
            if (payload.action === 'start') itemStatus = 'in_progress';
            if (payload.action === 'ready') itemStatus = 'ready';
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        item: {
                            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                            status: itemStatus,
                        },
                    },
                }),
            });
        });

        await page.route('**/api/kds/orders/*/handoff', async route => {
            served = true;
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        order: {
                            id: 'order-1',
                            status: 'served',
                        },
                    },
                }),
            });
        });

        await page.goto('/kds?restaurantId=rest-1');
        await expect(page.getByRole('heading', { name: /Kitchen Display/i })).toBeVisible();
        await expect(page.getByText('Table 12')).toBeVisible();
        await expect(page.getByText('1x Burger')).toBeVisible();

        await page.keyboard.press('1');
        await page.keyboard.press('s');
        await expect(page.getByText('Status: In Progress')).toBeVisible();

        await page.keyboard.press('r');
        await expect(page.getByText('Status: Ready')).toBeVisible();

        await page.goto('/expeditor?restaurantId=rest-1');
        await expect(page.getByRole('heading', { name: 'Expeditor Handoff' })).toBeVisible();
        await expect(page.getByText('Ready 1/1')).toBeVisible();
        const bumpButton = page.getByRole('button', { name: 'Bump Ticket (Served)' });
        await expect(bumpButton).toBeEnabled();
        await bumpButton.click();
        await expect(page.getByText('No active tickets')).toBeVisible();
    });
});
