import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { getDeviceContext } from '@/lib/api/authz';
import { POST as postBillRequest } from '@/app/api/v1/pos/device/tables/bill-request/route';

vi.mock('@/lib/api/authz', () => ({
    getDeviceContext: vi.fn(),
}));

const getDeviceContextMock = vi.mocked(getDeviceContext);

describe('POST /api/v1/pos/device/tables/bill-request', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when device token is missing/invalid', async () => {
        getDeviceContextMock.mockResolvedValue({
            ok: false,
            response: apiError('Missing device token', 401, 'DEVICE_UNAUTHORIZED'),
        } as any);

        const response = await postBillRequest(
            new Request('http://localhost/api/v1/pos/device/tables/bill-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
        );

        expect(response.status).toBe(401);
    });

    it('returns 400 for invalid payload', async () => {
        getDeviceContextMock.mockResolvedValue({
            ok: true,
            restaurantId: 'resto-1',
            device: { id: 'device-1' },
            admin: {},
        } as any);

        const response = await postBillRequest(
            new Request('http://localhost/api/v1/pos/device/tables/bill-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: 'missing table selector' }),
            })
        );

        expect(response.status).toBe(400);
    });
});
