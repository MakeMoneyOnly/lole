import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { getAgencyFleetAccess } from '@/lib/agency/access';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { queueAndDispatchManagedDeviceAction } from '@/lib/devices/management';

const InternalFleetActionSchema = z.object({
    action: z.enum(['reboot', 'wipe', 'push_update']),
    package_name: z.string().trim().max(200).optional(),
    app_version: z.string().trim().max(40).optional(),
    app_channel: z.string().trim().max(40).optional(),
});

export async function POST(
    request: Request,
    { params }: { params: Promise<{ deviceId: string }> }
) {
    const { deviceId } = await params;

    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const parsed = await parseJsonBody(request, InternalFleetActionSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const access = await getAgencyFleetAccess(auth.user.id);
    if (!access.ok) {
        return apiError(access.message ?? 'Forbidden', 403, 'FLEET_ACCESS_DENIED');
    }

    const admin = createServiceRoleClient();
    const { data: device, error: deviceError } = await admin
        .from('hardware_devices')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, device_type, device_profile, status, pairing_code, pairing_code_expires_at, pairing_state, management_provider, management_status, management_device_id, assigned_zones, metadata, last_active_at, created_at, updated_at'
        )
        .eq('id', deviceId)
        .in('restaurant_id', access.restaurantIds ?? [])
        .maybeSingle();

    if (deviceError || !device) {
        return apiError('Device not found', 404, 'DEVICE_NOT_FOUND', deviceError?.message);
    }

    if (device.management_provider !== 'esper' || !device.management_device_id) {
        return apiError(
            'This device is not fully configured for Esper remote actions',
            409,
            'DEVICE_NOT_MANAGED'
        );
    }

    try {
        const result = await queueAndDispatchManagedDeviceAction({
            admin,
            restaurantId: String(device.restaurant_id),
            userId: auth.user.id,
            device: device as Record<string, unknown>,
            action: parsed.data.action,
            packageName: parsed.data.package_name,
            appVersion: parsed.data.app_version,
            appChannel: parsed.data.app_channel,
        });

        return apiSuccess({
            action_id: result.actionId,
            provider_job_id: result.providerJobId,
            status: result.status,
        });
    } catch (error) {
        return apiError(
            'Failed to dispatch remote device action',
            502,
            'DEVICE_ACTION_DISPATCH_FAILED',
            error instanceof Error ? error.message : undefined
        );
    }
}
