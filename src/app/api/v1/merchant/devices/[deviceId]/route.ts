import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { writeAuditLog } from '@/lib/api/audit';
import type { Json } from '@/types/database';
import {
    revokeGatewayIdentityMetadata,
    rotateGatewayIdentityMetadata,
} from '@/lib/auth/offline-authz';
import { DEVICE_PAIRING_CODE_LENGTH } from '@/lib/devices/config';
import { z } from 'zod';

const DeviceIdentityActionSchema = z.object({
    action: z.enum(['rotate_identity', 'revoke_identity']),
});

function generatePairingCode(length = DEVICE_PAIRING_CODE_LENGTH): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(
        ''
    );
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ deviceId: string }> }
) {
    const { deviceId } = await params;

    const auth = await getAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) return context.response;

    // Verify the device belongs to this restaurant before deleting
    const { data: device, error: fetchError } = await context.supabase
        .from('hardware_devices')
        .select('id, name, device_type')
        .eq('id', deviceId)
        .eq('restaurant_id', context.restaurantId)
        .single();

    if (fetchError || !device) {
        return apiError('Device not found or access denied', 404, 'DEVICE_NOT_FOUND');
    }

    const { error: deleteError } = await context.supabase
        .from('hardware_devices')
        .delete()
        .eq('id', deviceId)
        .eq('restaurant_id', context.restaurantId);

    if (deleteError) {
        return apiError(
            'Failed to delete device',
            500,
            'DEVICE_DELETE_FAILED',
            deleteError.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'device_deleted',
        entity_type: 'hardware_devices',
        entity_id: deviceId,
        metadata: { name: device.name, device_type: device.device_type },
    });

    return apiSuccess({ deleted: true });
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ deviceId: string }> }
) {
    const { deviceId } = await params;
    const auth = await getAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) return context.response;

    const parsed = DeviceIdentityActionSchema.safeParse(await request.json());
    if (!parsed.success) {
        return apiError('Invalid device identity action', 400, 'INVALID_DEVICE_IDENTITY_ACTION');
    }

    const { data: device, error: fetchError } = await context.supabase
        .from('hardware_devices')
        .select('id, name, device_type, restaurant_id, metadata')
        .eq('id', deviceId)
        .eq('restaurant_id', context.restaurantId)
        .single();

    if (fetchError || !device) {
        return apiError('Device not found or access denied', 404, 'DEVICE_NOT_FOUND');
    }

    const now = new Date().toISOString();
    const currentMetadata =
        typeof device.metadata === 'object' && device.metadata !== null
            ? (device.metadata as Record<string, unknown>)
            : null;
    const rotating = parsed.data.action === 'rotate_identity';
    const nextMetadata = rotating
        ? rotateGatewayIdentityMetadata(currentMetadata, now)
        : revokeGatewayIdentityMetadata(currentMetadata, now);
    const updatePayload = rotating
        ? {
              metadata: nextMetadata as Json,
              device_token: null,
              pairing_state: 'ready',
              pairing_code: generatePairingCode(),
              pairing_code_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              paired_at: null,
              pairing_completed_at: null,
          }
        : {
              metadata: nextMetadata as Json,
              device_token: null,
              pairing_state: 'revoked',
              pairing_code: null,
              pairing_code_expires_at: null,
              paired_at: null,
              pairing_completed_at: null,
          };

    const { data: updatedDevice, error: updateError } = await context.supabase
        .from('hardware_devices')
        .update(updatePayload)
        .eq('id', deviceId)
        .eq('restaurant_id', context.restaurantId)
        .select('id, pairing_state, device_token, metadata, pairing_code, pairing_code_expires_at')
        .single();

    if (updateError || !updatedDevice) {
        return apiError(
            'Failed to update device identity',
            500,
            'DEVICE_IDENTITY_UPDATE_FAILED',
            updateError?.message
        );
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: rotating ? 'device_identity_rotated' : 'device_identity_revoked',
        entity_type: 'hardware_devices',
        entity_id: deviceId,
        metadata: {
            name: device.name,
            device_type: device.device_type,
            pairing_state: updatedDevice.pairing_state,
        },
    });

    return apiSuccess({
        device: updatedDevice,
    });
}
