import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { getAuthenticatedUser, getDeviceContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { POST as postSync } from '@/app/api/v1/system/sync/route';

const mockRestaurantId = '12345678-1234-1234-1234-123456789012';
const mockUserId = '87654321-4321-4321-4321-210987654321';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getDeviceContext: vi.fn(),
}));

vi.mock('@/lib/api/validation', () => ({
    parseJsonBody: vi.fn(async (request: Request) => ({
        success: true,
        data: await request.json(),
    })),
}));

vi.mock('@/lib/supabase/service-role', () => ({
    createServiceRoleClient: vi.fn(),
}));

vi.mock('@/lib/security/securityEvents', () => ({
    logSecurityEvent: vi.fn(),
}));

vi.mock('@/lib/sync/conflict-resolution', () => ({
    detectConflict: vi.fn(() => false),
    resolveConflict: vi.fn(),
    logConflictResolution: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getDeviceContextMock = vi.mocked(getDeviceContext);
const createServiceRoleClientMock = vi.mocked(createServiceRoleClient);

describe('sync api payroll tables', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getDeviceContextMock.mockResolvedValue({
            ok: false,
            response: NextResponse.json(
                { error: { code: 'DEVICE_UNAUTHORIZED', message: 'Device unauthorized' } },
                { status: 401 }
            ),
        } as never);
        getAuthenticatedUserMock.mockResolvedValue({
            ok: true,
            user: {
                id: mockUserId,
                email: 'test@example.com',
                aud: 'authenticated',
                role: 'authenticated',
            } as unknown as User,
            supabase: {} as never,
        });
    });

    it('accepts PowerSync writes for payroll runtime tables', async () => {
        const restaurantStaffChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: { restaurant_id: mockRestaurantId },
                error: null,
            }),
        };

        const syncIdempotencyQueryChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
        };

        const timeEntriesChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
        };

        const tipAllocationsChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
        };

        createServiceRoleClientMock.mockReturnValue({
            from: vi.fn((table: string) => {
                if (table === 'restaurant_staff') return restaurantStaffChain;
                if (table === 'sync_idempotency_keys') return syncIdempotencyQueryChain;
                if (table === 'time_entries') return timeEntriesChain;
                if (table === 'tip_allocations') return tipAllocationsChain;
                throw new Error(`Unexpected table ${table}`);
            }),
        } as never);

        const response = await postSync(
            new NextRequest('http://localhost/api/v1/system/sync', {
                method: 'POST',
                body: JSON.stringify({
                    clientId: 'tablet-1',
                    operations: [
                        {
                            id: '10000000-0000-0000-0000-000000000001',
                            operation: 'create',
                            tableName: 'time_entries',
                            recordId: '20000000-0000-0000-0000-000000000001',
                            data: {
                                staff_id: '30000000-0000-0000-0000-000000000001',
                                clock_in_at: '2026-04-29T08:00:00.000Z',
                            },
                            version: 1,
                            lastModified: '2026-04-29T08:00:00.000Z',
                            idempotencyKey: 'sync-time-entry-1',
                            restaurantId: mockRestaurantId,
                        },
                        {
                            id: '10000000-0000-0000-0000-000000000002',
                            operation: 'create',
                            tableName: 'tip_allocations',
                            recordId: '20000000-0000-0000-0000-000000000002',
                            data: {
                                tip_pool_id: '30000000-0000-0000-0000-000000000002',
                                period_date: '2026-04-29',
                                total_tips_distributed: 450,
                            },
                            version: 1,
                            lastModified: '2026-04-29T08:05:00.000Z',
                            idempotencyKey: 'sync-tip-allocation-1',
                            restaurantId: mockRestaurantId,
                        },
                    ],
                }),
            })
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.summary).toMatchObject({
            total: 2,
            succeeded: 2,
            failed: 0,
        });
    });
});
