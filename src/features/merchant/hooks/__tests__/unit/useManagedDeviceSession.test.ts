import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useManagedDeviceSession } from '../../useManagedDeviceSession';

const {
    mockGetStoredDeviceSession,
    mockStoreDeviceSession,
    mockBootstrapGatewayForPairedDevice,
    mockUseDeviceHeartbeat,
} = vi.hoisted(() => ({
    mockGetStoredDeviceSession: vi.fn(),
    mockStoreDeviceSession: vi.fn(),
    mockBootstrapGatewayForPairedDevice: vi.fn(),
    mockUseDeviceHeartbeat: vi.fn(),
}));

vi.mock('@/lib/mobile/device-storage', () => ({
    getStoredDeviceSession: mockGetStoredDeviceSession,
    storeDeviceSession: mockStoreDeviceSession,
}));

vi.mock('@/lib/gateway/device-bootstrap', () => ({
    bootstrapGatewayForPairedDevice: mockBootstrapGatewayForPairedDevice,
}));

vi.mock('../../useDeviceHeartbeat', () => ({
    useDeviceHeartbeat: mockUseDeviceHeartbeat,
}));

describe('useManagedDeviceSession', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('retries gateway bootstrap for paired devices when stored session was unavailable', async () => {
        mockGetStoredDeviceSession.mockResolvedValue({
            device_token: 'device-1',
            device_type: 'pos',
            device_profile: 'waiter',
            restaurant_id: 'rest-1',
            location_id: 'loc-1',
            gateway_bootstrap_status: 'unavailable',
            metadata: {},
        });
        mockBootstrapGatewayForPairedDevice.mockResolvedValue({
            gatewayId: 'gw-1',
            brokerUrl: 'ws://10.0.0.5:1884/mqtt',
            bootstrapUrl: 'http://10.0.0.5:8787/bootstrap',
            healthUrl: 'http://10.0.0.5:8787/health',
            operatingMode: 'offline-local',
            sessionToken: 'gateway-token',
            topicPrefix: 'lole/v1/restaurants/rest-1/locations/loc-1',
            issuedAt: '2026-04-30T10:00:00.000Z',
            expiresAt: '2026-04-30T11:00:00.000Z',
        });

        const { result } = renderHook(() =>
            useManagedDeviceSession({
                route: '/waiter',
                expectedProfiles: ['waiter'],
                requirePaired: true,
            })
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await waitFor(() => {
            expect(mockBootstrapGatewayForPairedDevice).toHaveBeenCalledOnce();
        });

        await waitFor(() => {
            expect(result.current.session?.gateway_bootstrap_status).toBe('ready');
        });

        expect(mockStoreDeviceSession).toHaveBeenCalledWith(
            expect.objectContaining({
                gateway_bootstrap_status: 'ready',
                gateway: expect.objectContaining({
                    gatewayId: 'gw-1',
                }),
            })
        );
    });
});
