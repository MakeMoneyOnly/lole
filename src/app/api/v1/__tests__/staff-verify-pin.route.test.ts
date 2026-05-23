import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as postVerifyPin } from '@/app/api/v1/merchant/core/staff/verify-pin/route';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { staffApplicationService } from '@/domains/staff/application/staff-application-service';
import { hashStaffPin } from '@/domains/staff/pin';

vi.mock('@/lib/api/authz', () => ({
    getAuthenticatedUser: vi.fn(),
    getAuthorizedRestaurantContext: vi.fn(),
}));

vi.mock('@/domains/staff/application/staff-application-service', () => ({
    staffApplicationService: {
        getStaff: vi.fn(),
        verifyPinByRestaurant: vi.fn(),
        verifyPin: vi.fn(),
        getStaffById: vi.fn(),
        getStaffByUserId: vi.fn(),
        createStaff: vi.fn(),
        updateStaff: vi.fn(),
        deleteStaff: vi.fn(),
        setStaffActive: vi.fn(),
        checkPermission: vi.fn(),
    },
}));

const getAuthenticatedUserMock = vi.mocked(getAuthenticatedUser);
const getAuthorizedRestaurantContextMock = vi.mocked(getAuthorizedRestaurantContext);
const staffApplicationServiceMock = vi.mocked(staffApplicationService);

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
        staffApplicationServiceMock.verifyPinByRestaurant.mockResolvedValue({
            success: true,
            data: {
                id: 'staff-2',
                restaurant_id: '11111111-1111-4111-8111-111111111111',
                user_id: 'user-b',
                role: 'waiter',
                name: 'Kalkidan H',
                pin_code: hashStaffPin('1234'),
                assigned_zones: null,
                created_at: '2026-01-01T00:00:00.000Z',
                is_active: true,
            },
        });

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
