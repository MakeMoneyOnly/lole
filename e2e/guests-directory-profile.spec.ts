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

test.describe('Guests directory and profile flows', () => {
    test.beforeEach(async ({ page, isMobile }) => {
        test.skip(isMobile, 'Guests workflow assertions are desktop-scoped in this spec.');
        await mockDashboardAuth(page);
    });

    test('loads guest directory, opens profile drawer, and saves updates', async ({ page }) => {
        let capturedPatchPayload: Record<string, unknown> | null = null;

        await page.route(
            '**/api/guests/11111111-1111-4111-8111-111111111111/visits**',
            async route => {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: {
                            visits: [
                                {
                                    id: 'visit-1',
                                    channel: 'delivery',
                                    visited_at: '2026-02-17T10:20:00.000Z',
                                    spend: 420.5,
                                    order_id: 'ord-101',
                                    metadata: {},
                                },
                            ],
                            total: 1,
                        },
                    }),
                });
            }
        );

        await page.route('**/api/guests/11111111-1111-4111-8111-111111111111', async route => {
            if (route.request().method() === 'PATCH') {
                capturedPatchPayload = route.request().postDataJSON() as Record<string, unknown>;
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        data: {
                            id: '11111111-1111-4111-8111-111111111111',
                            name: capturedPatchPayload?.name ?? 'Updated Guest',
                            language: capturedPatchPayload?.language ?? 'en',
                            tags: capturedPatchPayload?.tags ?? ['vip'],
                            is_vip: capturedPatchPayload?.is_vip ?? true,
                            notes: capturedPatchPayload?.notes ?? null,
                            visit_count: 5,
                            lifetime_value: 2800.25,
                            first_seen_at: '2025-12-20T09:00:00.000Z',
                            last_seen_at: '2026-02-17T10:20:00.000Z',
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
                        id: '11111111-1111-4111-8111-111111111111',
                        name: 'Selam Guest',
                        language: 'en',
                        tags: ['vip', 'weekday-lunch'],
                        is_vip: true,
                        notes: 'Prefers window seating',
                        visit_count: 5,
                        lifetime_value: 2800.25,
                        first_seen_at: '2025-12-20T09:00:00.000Z',
                        last_seen_at: '2026-02-17T10:20:00.000Z',
                    },
                }),
            });
        });

        await page.route('**/api/guests?**', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        guests: [
                            {
                                id: '11111111-1111-4111-8111-111111111111',
                                name: 'Selam Guest',
                                language: 'en',
                                tags: ['vip', 'weekday-lunch'],
                                is_vip: true,
                                first_seen_at: '2025-12-20T09:00:00.000Z',
                                last_seen_at: '2026-02-17T10:20:00.000Z',
                                visit_count: 5,
                                lifetime_value: 2800.25,
                                created_at: '2025-12-20T09:00:00.000Z',
                                updated_at: '2026-02-17T10:20:00.000Z',
                            },
                        ],
                        total: 1,
                    },
                }),
            });
        });

        await page.goto('/merchant/guests');

        await expect(page.getByRole('heading', { name: /Guests/i })).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Open guest profile for Selam Guest/i })
        ).toBeVisible();
        await expect(page.getByText(/ETB/i).first()).toBeVisible();

        await page.getByRole('button', { name: /Open guest profile for Selam Guest/i }).click();

        const profileDialog = page.getByRole('dialog', { name: 'Guest Profile' });
        await expect(profileDialog).toBeVisible();

        await page.getByLabel('Name', { exact: true }).fill('Selam Updated');
        await page.getByLabel('Language').selectOption('am');
        await page.getByRole('button', { name: '+ family' }).click();
        await page.getByLabel('Notes').fill('Prefers quiet corner table');
        await page.getByRole('button', { name: 'Save' }).click();

        expect(capturedPatchPayload).toBeTruthy();
        expect(capturedPatchPayload).toMatchObject({
            name: 'Selam Updated',
            language: 'am',
            notes: 'Prefers quiet corner table',
        });
        const tags = ((capturedPatchPayload as any)?.tags ?? []) as string[];
        expect(tags).toContain('family');
    });
});
