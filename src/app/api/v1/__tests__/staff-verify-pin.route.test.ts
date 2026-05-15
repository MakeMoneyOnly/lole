import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as postVerifyPin } from '@/app/api/v1/merchant/core/staff/verify-pin/route';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { hashStaffPin } from '@/domains/staff/pin';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

vi.mock('@/lib/supabase/service-role', () => ({
    createServiceRoleClient: vi.fn(),
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);
const createServiceRoleClientMock = vi.mocked(createServiceRoleClient);

describe('staff verify pin route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getAuthenticatedUserMock.mockResolvedValue({
            ok: true,
            user: { id: 'user-1' },
        } as never);
        getAuthorizedRestaurantContextMock.mockResolvedValue({
            ok: true,
            restaurantId: '11111111-1111-4111-8111-111111111111',
        } as never);
    });

    it('matches hashed active staff pins from fetched restaurant staff rows', async () => {
        const staffRows = [
            {
                id: 'staff-1',
                user_id: 'user-a',
                role: 'waiter',
                name: 'Other Staff',
                email: 'other@example.com',
                pin_code: hashStaffPin('0000'),
                staff_name: 'Other Staff',
            },
            {
                id: 'staff-2',
                user_id: 'user-b',
                role: 'waiter',
                name: 'Kalkidan',
                email: 'kalkidan@example.com',
                pin_code: hashStaffPin('1234'),
                staff_name: 'Kalkidan H',
            },
        ];

        createServiceRoleClientMock.mockReturnValue({
            from: vi.fn(() => {
                const chain: Record<string, ReturnType<typeof vi.fn>> = {};
                chain.select = vi.fn(() => chain);
                chain.eq = vi
                    .fn()
                    .mockReturnValueOnce(chain)
                    .mockResolvedValueOnce({ data: staffRows, error: null });
                return chain;
            }),
        } as never);

        const response = await postVerifyPin(
            new Request('http://localhost/api/v1/merchant/core/staff/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: '11111111-1111-4111-8111-111111111111',
                    pin: '1234',
                }),
            })
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.staff).toMatchObject({
            id: 'staff-2',
            name: 'Kalkidan H',
            role: 'waiter',
        });
        expect(payload.data.staff.session_expires_at).toBeTruthy();
    });
});
