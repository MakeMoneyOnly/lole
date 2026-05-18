import { useState, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { logger } from '@/lib/logger';
import type {
    DeviceProfile,
    HardwareDeviceMetadata,
    HardwareDeviceType,
    ManagementProvider,
} from '@/lib/devices/config';

export type HardwareDevice = {
    id: string;
    restaurant_id: string;
    name: string;
    device_type: HardwareDeviceType;
    device_profile?: DeviceProfile | null;
    status: 'active' | 'inactive' | 'maintenance';
    pairing_code: string | null;
    device_token: string | null;
    paired_at: string | null;
    last_active_at: string | null;
    pairing_code_expires_at?: string | null;
    pairing_state?: 'ready' | 'paired' | 'revoked' | 'expired' | null;
    assigned_zones: string[];
    management_provider?: ManagementProvider | null;
    location_id?: string | null;
    metadata?: HardwareDeviceMetadata | null;
    created_at: string;
};

export function useDevices(initialData?: HardwareDevice[]) {
    const [devices, setDevices] = useState<HardwareDevice[]>(initialData ?? []);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<string | null>(null);

    const fetchDevices = useCallback(async () => {
        try {
            // Only set loading to true if we don't have data yet
            if (devices.length === 0) {
                setLoading(true);
            }
            setError(null);
            const response = await fetch('/api/v1/merchant/devices', { method: 'GET' });

            if (!response.ok) {
                let errorMessage = 'Failed to fetch devices.';
                try {
                    const errorPayload = await response.json();
                    errorMessage = errorPayload?.error ?? errorMessage;
                } catch {
                    errorMessage = `Error ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const payload = await response.json();
            const freshDevices = (payload?.data?.devices ?? []) as HardwareDevice[];
            setDevices(freshDevices);
        } catch (fetchError) {
            logger.error('Failed to fetch devices', fetchError, {
                source: '[features/merchant/hooks/useDevices]',
            });
            setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch devices.');
        } finally {
            setLoading(false);
        }
    }, [devices.length]);

    useEffect(() => {
        void fetchDevices();
    }, [fetchDevices]);

    const handleProvisionDevice = async (payload: {
        name: string;
        device_type?: HardwareDeviceType;
        device_profile?: DeviceProfile;
        location_id?: string;
        assigned_zones?: string[];
        metadata?: HardwareDeviceMetadata;
    }): Promise<void> => {
        try {
            const response = await fetch('/api/v1/merchant/devices/provision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error ?? 'Failed to provision device.');
            }

            // Re-fetch or locally append
            setDevices(prev => [...prev, result.data.device]);
            toast.success('Device provisioned successfully.');
            return result.data.device as HardwareDevice;
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to provision device.');
            return null;
        }
    };

    const handleDeleteDevice = async (deviceId: string): Promise<boolean> => {
        // Optimistic remove
        setDevices(prev => prev.filter(d => d.id !== deviceId));
        try {
            const response = await fetch(`/api/v1/merchant/devices/${deviceId}`, {
                method: 'DELETE',
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error ?? 'Failed to delete device.');
            }
            toast.success('Device removed.');
            return true;
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete device.');
            // Re-fetch to restore correct state
            void fetchDevices();
            return false;
        }
    };

    const updateDeviceIdentity = async (
        deviceId: string,
        action: 'rotate_identity' | 'revoke_identity'
    ): Promise<HardwareDevice | null> => {
        try {
            const response = await fetch(`/api/v1/merchant/devices/${deviceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error ?? 'Failed to update device identity.');
            }

            const nextDevice = result.data.device as HardwareDevice;
            setDevices(prev =>
                prev.map(device => (device.id === deviceId ? { ...device, ...nextDevice } : device))
            );
            toast.success(
                action === 'rotate_identity'
                    ? 'Device identity rotated.'
                    : 'Device identity revoked.'
            );
            return nextDevice;
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to update device identity.');
            return null;
        }
    };

    return {
        devices,
        loading,
        error,
        fetchDevices,
        handleProvisionDevice,
        handleDeleteDevice,
        handleRotateDeviceIdentity: (deviceId: string) =>
            updateDeviceIdentity(deviceId, 'rotate_identity'),
        handleRevokeDeviceIdentity: (deviceId: string) =>
            updateDeviceIdentity(deviceId, 'revoke_identity'),
    };
}
