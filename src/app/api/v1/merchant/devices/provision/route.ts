import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { normalizeDeviceMetadata, type DeviceManagementMetadata } from '@/lib/devices/config';
import {
    hydrateEnterpriseDeviceRecord,
    isEnterpriseDeviceSchemaError,
    mergeEnterpriseShellMetadata,
} from '@/lib/devices/schema-compat';
import {
    ProvisionDeviceSchema,
    buildPairingExpiry,
    generatePairingCode,
    getDeviceBootPathFromRecord,
    resolveProvisionedDeviceShape,
} from '@/lib/devices/pairing';

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, ProvisionDeviceSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { deviceType, deviceProfile } = resolveProvisionedDeviceShape(parsed.data);
    const pairing_code = generatePairingCode();
    const adminClient = createServiceRoleClient();
    const rawMetadata =
        parsed.data.metadata && typeof parsed.data.metadata === 'object'
            ? parsed.data.metadata
            : undefined;
    const pairingCodeExpiresAt = buildPairingExpiry();
    const managementMetadata: DeviceManagementMetadata = {
        ...((rawMetadata?.management as Record<string, unknown> | undefined) ?? {}),
        provider: 'esper' as const,
    };
    const normalizedMetadata = normalizeDeviceMetadata(
        deviceType,
        {
            ...(rawMetadata ?? {}),
            management: managementMetadata,
        },
        deviceProfile
    );

    const insertEnterprise = () =>
        adminClient
            .from('hardware_devices')
            .insert({
                restaurant_id: context.restaurantId,
                name: parsed.data.name,
                location_id: parsed.data.location_id ?? null,
                device_type: deviceType,
                device_profile: deviceProfile,
                pairing_code,
                pairing_code_expires_at: pairingCodeExpiresAt,
                pairing_state: 'ready',
                management_provider: 'esper',
                management_status: 'pending',
                assigned_zones: parsed.data.assigned_zones ?? [],
                metadata: normalizedMetadata,
            })
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, name, device_type, device_profile, status, pairing_code, pairing_code_expires_at, pairing_state, management_provider, management_status, management_device_id, assigned_zones, metadata, last_active_at, created_at, updated_at'
            )
            .single();

    let { data, error } = await insertEnterprise();

    if (error && isEnterpriseDeviceSchemaError(error.message)) {
        const legacyMetadata = mergeEnterpriseShellMetadata(normalizedMetadata, {
            device_profile: deviceProfile,
            location_id: parsed.data.location_id ?? null,
            pairing_state: 'ready',
            pairing_code_expires_at: pairingCodeExpiresAt,
            management_provider: 'esper',
            management_status: 'pending',
        });

        const legacyResult = await adminClient
            .from('hardware_devices')
            .insert({
                restaurant_id: context.restaurantId,
                name: parsed.data.name,
                device_type: deviceType,
                pairing_code,
                assigned_zones: parsed.data.assigned_zones ?? [],
                metadata: legacyMetadata,
            })
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, name, device_type, device_profile, status, pairing_code, pairing_code_expires_at, pairing_state, management_provider, management_status, management_device_id, assigned_zones, metadata, last_active_at, created_at, updated_at'
            )
            .single();

        data = legacyResult.data;
        error = legacyResult.error;
    }

    if (error) {
        if (
            deviceType === 'terminal' &&
            /device_type|hardware_devices_device_type_check|violates check constraint/i.test(
                error.message
            )
        ) {
            return apiError(
                'Terminal provisioning requires the latest database migration. Apply the new hardware device migration and try again.',
                500,
                'TERMINAL_DEVICE_MIGRATION_REQUIRED',
                error.message
            );
        }

        return apiError(
            'Failed to provision device',
            500,
            'DEVICE_PROVISION_FAILED',
            error.message
        );
    }

    const { data: restaurant } = await adminClient
        .from('restaurants')
        .select('slug')
        .eq('id', context.restaurantId)
        .maybeSingle();

    const setupPath = restaurant?.slug
        ? `/${restaurant.slug}/setup?code=${encodeURIComponent(pairing_code)}`
        : null;
    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? null;
    const bootPath = getDeviceBootPathFromRecord({
        device_profile: data?.device_profile ?? deviceProfile,
        device_type: data?.device_type ?? deviceType,
        restaurant_slug: restaurant?.slug ?? null,
    });

    return apiSuccess(
        {
            device: data
                ? hydrateEnterpriseDeviceRecord(
                      data as Parameters<typeof hydrateEnterpriseDeviceRecord>[0]
                  )
                : data,
            rollout: {
                pairing_code,
                pairing_code_expires_at: pairingCodeExpiresAt,
                setup_path: setupPath,
                setup_url: setupPath && appBaseUrl ? `${appBaseUrl}${setupPath}` : null,
                boot_path: bootPath,
            },
        },
        201
    );
}
