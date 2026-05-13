import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { queueAndDispatchManagedDeviceAction } from '@/lib/devices/management';

const DeviceManagementActionSchema = z.object({
    action: z.enum(['reboot', 'wipe', 'push_update']),
    package_name: z.string().trim().max(200).optional(),
    app_version: z.string().trim().max(40).optional(),
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

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, DeviceManagementActionSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const admin = createServiceRoleClient();
    const { data: device, error: deviceError } = await admin
        .from('hardware_devices')
        .select(
            'id, restaurant_id, name, management_provider, management_device_id, device_profile, device_type'
        )
        .eq('id', deviceId)
        .eq('restaurant_id', context.restaurantId)
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
            restaurantId: context.restaurantId,
            userId: auth.user.id,
            device: device as Record<string, unknown>,
            action: parsed.data.action,
            packageName: parsed.data.package_name,
            appVersion: parsed.data.app_version,
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
