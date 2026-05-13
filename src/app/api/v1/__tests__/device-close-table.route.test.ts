import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError } from '@/lib/api/response';
import { getDeviceContext } from '@/lib/api/authz';
import { POST as postCloseTable } from '@/app/api/v1/pos/device/tables/close/route';

vi.mock('@/lib/api/authz', () => ({
    getDeviceContext: vi.fn(),
}));

const getDeviceContextMock = vi.mocked(getDeviceContext);

describe('POST /api/v1/pos/device/tables/close', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 401 when device token is missing/invalid', async () => {
        getDeviceContextMock.mockResolvedValue({
            ok: false,
            response: apiError('Missing device token', 401, 'DEVICE_UNAUTHORIZED'),
        } as any);

        const response = await postCloseTable(
            new Request('http://localhost/api/v1/pos/device/tables/close', {
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

        const response = await postCloseTable(
            new Request('http://localhost/api/v1/pos/device/tables/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    table_number: 'A1',
                    payment: { provider: 'chapa', tx_ref: '' },
                }),
            })
        );

        expect(response.status).toBe(400);
    });
});
