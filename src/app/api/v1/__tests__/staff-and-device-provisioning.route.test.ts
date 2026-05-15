import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getStaff } from '@/app/api/v1/merchant/core/staff/route';
import { POST as postDeviceProvision } from '@/app/api/v1/merchant/devices/provision/route';
import { PATCH as patchDeviceIdentity } from '@/app/api/v1/merchant/devices/[deviceId]/route';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { writeAuditLog } from '@/lib/api/audit';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

vi.mock('@/lib/supabase/service-role', () => ({
    createServiceRoleClient: vi.fn(),
}));

vi.mock('@/lib/api/audit', () => ({
    writeAuditLog: vi.fn(),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);
const createServiceRoleClientMock = vi.mocked(createServiceRoleClient);
const writeAuditLogMock = vi.mocked(writeAuditLog);

function setAuthContextOk() {
    getAuthenticatedUserMock.mockResolvedValue({
        ok: true,
        user: { id: 'user-1' },
        supabase: {},
    } as any);
    getAuthorizedRestaurantContextMock.mockResolvedValue({
        ok: true,
        restaurantId: 'resto-1',
        supabase: {},
    } as any);
}

describe('staff and device provisioning routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        writeAuditLogMock.mockResolvedValue({ error: null });
    });

    it('GET /api/v1/merchant/core/staff merges base staff rows with enriched user fields', async () => {
        setAuthContextOk();

        const fromMock = vi.fn((table: string) => {
            if (table === 'restaurant_staff') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            order: vi.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: 'staff-1',
                                        user_id: 'user-a',
                                        role: 'waiter',
                                        is_active: true,
                                        created_at: '2026-03-07T00:00:00.000Z',
                                        name: 'PIN Staff',
                                        pin_code: '1234',
                                        assigned_zones: ['rooftop'],
                                    },
                                ],
                                error: null,
                            }),
                        })),
                    })),
                };
            }

            if (table === 'restaurant_staff_with_users') {
                return {
                    select: vi.fn(() => ({
                        eq: vi.fn(() => ({
                            in: vi.fn().mockResolvedValue({
                                data: [
                                    {
                                        id: 'staff-1',
                                        user_id: 'user-a',
                                        email: 'waiter@example.com',
                                        name: 'Kaleab',
                                        full_name: 'Kaleab T',
                                        first_name: 'Kaleab',
                                        last_name: 'T',
                                    },
                                ],
                                error: null,
                            }),
                        })),
                    })),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        createServiceRoleClientMock.mockReturnValue({
            from: fromMock,
        } as any);

        const response = await getStaff();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.staff[0]).toMatchObject({
            id: 'staff-1',
            email: 'waiter@example.com',
            name: 'Kaleab',
            pin_code: '1234',
            assigned_zones: ['rooftop'],
        });
    });

    it('POST /api/v1/merchant/devices/provision returns a migration-specific error for terminal constraint mismatch', async () => {
        setAuthContextOk();

        createServiceRoleClientMock.mockReturnValue({
            from: vi.fn(() => ({
                insert: vi.fn(() => ({
                    select: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({
                            data: null,
                            error: {
                                message:
                                    'new row for relation "hardware_devices" violates check constraint "hardware_devices_device_type_check"',
                            },
                        }),
                    })),
                })),
            })),
        } as any);

        const response = await postDeviceProvision(
            new Request('http://localhost/api/v1/merchant/devices/provision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Terminal 1',
                    device_type: 'terminal',
                }),
            })
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body.error.code).toBe('TERMINAL_DEVICE_MIGRATION_REQUIRED');
    });

    it('POST /api/v1/merchant/devices/provision assigns a six-character pairing code and device profile', async () => {
        setAuthContextOk();

        createServiceRoleClientMock.mockReturnValue({
            from: vi.fn((table: string) => {
                if (table === 'hardware_devices') {
                    return {
                        insert: vi.fn(() => ({
                            select: vi.fn(() => ({
                                single: vi.fn().mockResolvedValue({
                                    data: {
                                        id: 'device-1',
                                        pairing_code: 'A1B2C3',
                                        device_type: 'terminal',
                                        device_profile: 'cashier',
                                    },
                                    error: null,
                                }),
                            })),
                        })),
                    };
                }

                if (table === 'restaurants') {
                    return {
                        select: vi.fn(() => ({
                            eq: vi.fn(() => ({
                                maybeSingle: vi.fn().mockResolvedValue({
                                    data: {
                                        slug: 'cafe-lucia',
                                    },
                                    error: null,
                                }),
                            })),
                        })),
                    };
                }

                throw new Error(`Unexpected table ${table}`);
            }),
        } as any);

        const response = await postDeviceProvision(
            new Request('http://localhost/api/v1/merchant/devices/provision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Terminal 1',
                    device_profile: 'cashier',
                }),
            })
        );
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body.data.device.pairing_code).toMatch(/^[A-Z0-9]{6}$/);
        expect(body.data.device.device_profile).toBe('cashier');
        expect(body.data.rollout.boot_path).toBe('/terminal');
        expect(body.data.rollout.pairing_code).toMatch(/^[A-Z0-9]{6}$/);
        expect(body.data.rollout.setup_path).toBe(
            `/cafe-lucia/setup?code=${body.data.rollout.pairing_code}`
        );
    });

    it('PATCH /api/v1/merchant/devices/[deviceId] rotates identity by clearing live token and incrementing version', async () => {
        setAuthContextOk();

        const singleMock = vi
            .fn()
            .mockResolvedValueOnce({
                data: {
                    id: 'device-1',
                    name: 'Front Cashier',
                    device_type: 'terminal',
                    restaurant_id: 'resto-1',
                    metadata: {
                        gateway_identity: {
                            version: 2,
                            issued_at: '2026-04-21T10:00:00.000Z',
                            rotated_at: '2026-04-21T10:00:00.000Z',
                            revoked_at: null,
                        },
                    },
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    id: 'device-1',
                    pairing_state: 'ready',
                    device_token: null,
                    metadata: {
                        gateway_identity: {
                            version: 3,
                            revoked_at: null,
                        },
                    },
                },
                error: null,
            });

        const eqRestaurantMock = vi.fn(() => ({ single: singleMock }));
        const eqIdMock = vi.fn(() => ({ eq: eqRestaurantMock }));
        const selectMock = vi.fn(() => ({ eq: eqIdMock }));
        const updateSelectMock = vi.fn(() => ({ single: singleMock }));
        const updateEqRestaurantMock = vi.fn(() => ({ select: updateSelectMock }));
        const updateEqIdMock = vi.fn(() => ({ eq: updateEqRestaurantMock }));
        const updateMock = vi.fn(() => ({ eq: updateEqIdMock }));

        const fromMock = vi.fn(() => ({
            select: selectMock,
            update: updateMock,
        }));

        getAuthorizedRestaurantContextMock.mockResolvedValue({
            ok: true,
            restaurantId: 'resto-1',
            supabase: {
                from: fromMock,
            },
        } as never);

        const response = await patchDeviceIdentity(
            new Request('http://localhost/api/v1/merchant/devices/device-1', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'rotate_identity' }),
            }),
            { params: Promise.resolve({ deviceId: 'device-1' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                pairing_state: 'ready',
                device_token: null,
                metadata: expect.objectContaining({
                    gateway_identity: expect.objectContaining({
                        version: 3,
                        revoked_at: null,
                    }),
                }),
            })
        );
        expect(body.data.device.metadata.gateway_identity.version).toBe(3);
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ action: 'device_identity_rotated' })
        );
    });

    it('PATCH /api/v1/merchant/devices/[deviceId] revokes identity and marks device revoked', async () => {
        setAuthContextOk();

        const singleMock = vi
            .fn()
            .mockResolvedValueOnce({
                data: {
                    id: 'device-2',
                    name: 'Kitchen Screen',
                    device_type: 'kds',
                    restaurant_id: 'resto-1',
                    metadata: {
                        gateway_identity: {
                            version: 5,
                            revoked_at: null,
                        },
                    },
                },
                error: null,
            })
            .mockResolvedValueOnce({
                data: {
                    id: 'device-2',
                    pairing_state: 'revoked',
                    device_token: null,
                    metadata: {
                        gateway_identity: {
                            version: 5,
                            revoked_at: '2026-04-22T00:00:00.000Z',
                        },
                    },
                },
                error: null,
            });

        const eqRestaurantMock = vi.fn(() => ({ single: singleMock }));
        const eqIdMock = vi.fn(() => ({ eq: eqRestaurantMock }));
        const selectMock = vi.fn(() => ({ eq: eqIdMock }));
        const updateSelectMock = vi.fn(() => ({ single: singleMock }));
        const updateEqRestaurantMock = vi.fn(() => ({ select: updateSelectMock }));
        const updateEqIdMock = vi.fn(() => ({ eq: updateEqRestaurantMock }));
        const updateMock = vi.fn(() => ({ eq: updateEqIdMock }));

        const fromMock = vi.fn(() => ({
            select: selectMock,
            update: updateMock,
        }));

        getAuthorizedRestaurantContextMock.mockResolvedValue({
            ok: true,
            restaurantId: 'resto-1',
            supabase: {
                from: fromMock,
            },
        } as never);

        const response = await patchDeviceIdentity(
            new Request('http://localhost/api/v1/merchant/devices/device-2', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'revoke_identity' }),
            }),
            { params: Promise.resolve({ deviceId: 'device-2' }) }
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                pairing_state: 'revoked',
                device_token: null,
                metadata: expect.objectContaining({
                    gateway_identity: expect.objectContaining({
                        version: 5,
                    }),
                }),
            })
        );
        expect(body.data.device.pairing_state).toBe('revoked');
        expect(body.data.device.metadata.gateway_identity.revoked_at).toBeTruthy();
        expect(writeAuditLogMock).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ action: 'device_identity_revoked' })
        );
    });
});
