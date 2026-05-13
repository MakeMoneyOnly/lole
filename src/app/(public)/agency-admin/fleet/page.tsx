import {
    FleetManagementPageClient,
    type FleetActionRecord,
    type FleetDeviceRecord,
} from '@/components/agency/FleetManagementPageClient';
import { getAgencyFleetAccess } from '@/lib/agency/access';
import { requireAdminOrManager } from '@/lib/auth/requireAuth';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export default async function AgencyFleetPage() {
    const auth = await requireAdminOrManager();
    const access = await getAgencyFleetAccess(auth.user.id);

    if (!access.ok) {
        return null;
    }

    const admin = createServiceRoleClient();
    const restaurantIds = access.restaurantIds ?? [];

    if (restaurantIds.length === 0) {
        return <FleetManagementPageClient devices={[]} actions={[]} />;
    }

    const [{ data: restaurants }, { data: devices }, { data: actions }] = await Promise.all([
        admin.from('restaurants').select('id, name').in('id', restaurantIds),
        admin
            .from('hardware_devices')
            .select('*')
            .in('restaurant_id', restaurantIds)
            .order('updated_at', { ascending: false }),
        admin
            .from('device_management_actions')
            .select('id, hardware_device_id, action_type, status, requested_at, provider_job_id')
            .in('restaurant_id', restaurantIds)
            .order('requested_at', { ascending: false })
            .limit(120),
    ]);

    const restaurantNames = new Map(
        (restaurants ?? []).map(restaurant => [
            String(restaurant.id),
            String(restaurant.name ?? 'Restaurant'),
        ])
    );

    const fleetDevices: FleetDeviceRecord[] = (devices ?? []).map(device => {
        const metadata = readRecord(device.metadata);
        const management = readRecord(metadata.management);

        return {
            id: String(device.id),
            restaurantId: String(device.restaurant_id),
            restaurantName: restaurantNames.get(String(device.restaurant_id)) ?? 'Restaurant',
            name: String(device.name ?? 'Managed Device'),
            deviceProfile: String(device.device_profile ?? 'waiter'),
            deviceType: String(device.device_type ?? 'pos'),
            pairingState: String(device.pairing_state ?? 'ready'),
            managementProvider: String(device.management_provider ?? 'none'),
            managementStatus: String(device.management_status ?? 'unmanaged'),
            managementDeviceId:
                device.management_device_id !== null && device.management_device_id !== undefined
                    ? String(device.management_device_id)
                    : null,
            appVersion:
                device.app_version !== null && device.app_version !== undefined
                    ? String(device.app_version)
                    : null,
            appChannel:
                device.app_channel !== null && device.app_channel !== undefined
                    ? String(device.app_channel)
                    : typeof management.app_channel === 'string'
                      ? management.app_channel
                      : null,
            targetAppVersion:
                device.target_app_version !== null && device.target_app_version !== undefined
                    ? String(device.target_app_version)
                    : typeof management.target_app_version === 'string'
                      ? management.target_app_version
                      : null,
            otaStatus:
                device.ota_status !== null && device.ota_status !== undefined
                    ? String(device.ota_status)
                    : typeof management.ota_status === 'string'
                      ? management.ota_status
                      : 'current',
            otaError:
                device.ota_error !== null && device.ota_error !== undefined
                    ? String(device.ota_error)
                    : typeof management.ota_error === 'string'
                      ? management.ota_error
                      : null,
            lastActiveAt:
                device.last_active_at !== null && device.last_active_at !== undefined
                    ? String(device.last_active_at)
                    : null,
            lastBootAt:
                device.last_boot_at !== null && device.last_boot_at !== undefined
                    ? String(device.last_boot_at)
                    : null,
        };
    });

    const fleetActions: FleetActionRecord[] = (actions ?? []).map(action => ({
        id: String(action.id),
        hardwareDeviceId: String(action.hardware_device_id),
        actionType: String(action.action_type),
        status: String(action.status),
        requestedAt:
            action.requested_at !== null && action.requested_at !== undefined
                ? String(action.requested_at)
                : null,
        providerJobId:
            action.provider_job_id !== null && action.provider_job_id !== undefined
                ? String(action.provider_job_id)
                : null,
    }));

    return <FleetManagementPageClient devices={fleetDevices} actions={fleetActions} />;
}
