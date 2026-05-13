import { apiError, apiSuccess } from '@/lib/api/response';
import { parseJsonBody } from '@/lib/api/validation';
import {
    HardwareDeviceTypeSchema,
    DeviceProfileSchema,
    normalizeDeviceMetadata,
    type DeviceProfile,
    type HardwareDeviceType,
} from '@/lib/devices/config';
import {
    hydrateEnterpriseDeviceRecord,
    isEnterpriseDeviceSchemaError,
    mergeEnterpriseShellMetadata,
    readEnterpriseShellMetadata,
} from '@/lib/devices/schema-compat';
import {
    PairDeviceSchema,
    generateDeviceToken,
    getDeviceBootPathFromRecord,
    normalizePairingCode,
} from '@/lib/devices/pairing';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { setDeviceTokenCookies, type DeviceMetadata } from '@/lib/auth/device-token-cookies';
import {
    buildGatewayIdentityMetadata,
    buildOfflineStaffOutagePolicyMetadata,
} from '@/lib/auth/offline-authz';

export async function POST(request: Request) {
    const parsed = await parseJsonBody(request, PairDeviceSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const code = normalizePairingCode(parsed.data.code ?? parsed.data.pairing_code ?? '');
    if (code.length < 4) {
        return apiError('Invalid pairing code', 400, 'INVALID_PAIRING_CODE');
    }

    const adminClient = createServiceRoleClient();
    const fetchEnterpriseDevice = () =>
        adminClient
            .from('hardware_devices')
            .select(
                'id, restaurant_id, location_id, device_type, device_profile, name, assigned_zones, metadata, pairing_state, pairing_code_expires_at'
            )
            .eq('pairing_code', code)
            .in('pairing_state', ['ready', 'paired'])
            .maybeSingle();

    let device: Record<string, unknown> | null = null;
    let error: { message: string } | null = null;

    const enterpriseResult = await fetchEnterpriseDevice();
    device = (enterpriseResult.data as Record<string, unknown> | null) ?? null;
    error = enterpriseResult.error;

    if (error && isEnterpriseDeviceSchemaError(error.message)) {
        const legacyResult = await adminClient
            .from('hardware_devices')
            .select('id, restaurant_id, device_type, name, assigned_zones, metadata, paired_at')
            .eq('pairing_code', code)
            .maybeSingle();

        device = (legacyResult.data as Record<string, unknown> | null) ?? null;
        error = legacyResult.error;

        if (device) {
            const shell = readEnterpriseShellMetadata(
                typeof device.metadata === 'object' && device.metadata !== null
                    ? (device.metadata as Record<string, unknown>)
                    : {},
                HardwareDeviceTypeSchema.safeParse(device.device_type).success
                    ? (device.device_type as HardwareDeviceType)
                    : 'pos'
            );

            if (shell.pairing_state !== 'ready' && shell.pairing_state !== 'paired') {
                device = null;
            } else {
                device = {
                    ...device,
                    location_id: shell.location_id,
                    device_profile: shell.device_profile,
                    pairing_state: shell.pairing_state,
                    pairing_code_expires_at: shell.pairing_code_expires_at,
                } as Record<string, unknown>;
            }
        }
    }

    if (error || !device) {
        return apiError('Invalid or expired pairing code', 400, 'INVALID_PAIRING_CODE');
    }

    if (
        typeof device.pairing_code_expires_at === 'string' &&
        new Date(device.pairing_code_expires_at).getTime() < Date.now()
    ) {
        await adminClient
            .from('hardware_devices')
            .update({ pairing_state: 'expired' })
            .eq('id', String(device.id));
        return apiError('Pairing code has expired', 410, 'PAIRING_CODE_EXPIRED');
    }

    const { data: restaurant } = await adminClient
        .from('restaurants')
        .select('slug')
        .eq('id', String(device.restaurant_id))
        .maybeSingle();

    const device_token = generateDeviceToken();
    const now = new Date().toISOString();
    const rawMetadata =
        typeof device.metadata === 'object' && device.metadata !== null
            ? (device.metadata as Record<string, unknown>)
            : {};
    const resolvedDeviceType = HardwareDeviceTypeSchema.safeParse(device.device_type).success
        ? (device.device_type as HardwareDeviceType)
        : 'pos';
    const resolvedProfile = DeviceProfileSchema.safeParse(device.device_profile).success
        ? (device.device_profile as DeviceProfile)
        : null;
    const normalizedMetadata = normalizeDeviceMetadata(
        resolvedDeviceType,
        {
            ...rawMetadata,
            runtime: {
                ...((rawMetadata.runtime as Record<string, unknown> | undefined) ?? {}),
                native_platform: parsed.data.platform ?? null,
                native_version: parsed.data.app_version ?? null,
                last_heartbeat_at: now,
            },
            printer: parsed.data.printer
                ? {
                      ...((rawMetadata.printer as Record<string, unknown> | undefined) ?? {}),
                      ...parsed.data.printer,
                      auto_connect: true,
                      last_selected_at: now,
                  }
                : (rawMetadata.printer as Record<string, unknown> | undefined),
        },
        resolvedProfile
    );
    const gatewayAwareMetadata = buildOfflineStaffOutagePolicyMetadata({
        metadata: buildGatewayIdentityMetadata(normalizedMetadata, now),
        deviceType: resolvedDeviceType,
        deviceProfile: resolvedProfile,
        nowIso: now,
    });

    let updateError: { message: string } | null = null;

    const enterpriseUpdate = await adminClient
        .from('hardware_devices')
        .update({
            device_token,
            pairing_state: 'paired',
            paired_at: now,
            pairing_completed_at: now,
            last_active_at: now,
            hardware_fingerprint: parsed.data.device_uuid ?? null,
            app_version: parsed.data.app_version ?? null,
            printer_connection_type: parsed.data.printer?.connection_type ?? null,
            printer_device_id: parsed.data.printer?.device_id ?? null,
            printer_device_name: parsed.data.printer?.device_name ?? null,
            printer_mac_address: parsed.data.printer?.mac_address ?? null,
            metadata: gatewayAwareMetadata,
        })
        .eq('id', String(device.id));

    updateError = enterpriseUpdate.error;

    if (updateError && isEnterpriseDeviceSchemaError(updateError.message)) {
        const legacyMetadata = mergeEnterpriseShellMetadata(gatewayAwareMetadata, {
            device_profile: resolvedProfile,
            location_id: (device.location_id as string | null | undefined) ?? null,
            pairing_state: 'paired',
            pairing_completed_at: now,
            hardware_fingerprint: parsed.data.device_uuid ?? null,
        });

        const legacyUpdate = await adminClient
            .from('hardware_devices')
            .update({
                device_token,
                paired_at: now,
                last_active_at: now,
                metadata: legacyMetadata,
            })
            .eq('id', String(device.id));

        updateError = legacyUpdate.error;
    }

    if (updateError) {
        return apiError('Failed to pair device', 500, 'DEVICE_PAIR_FAILED', updateError.message);
    }

    const hydratedDevice = hydrateEnterpriseDeviceRecord(
        device as unknown as Parameters<typeof hydrateEnterpriseDeviceRecord>[0]
    ) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    const boot_path = getDeviceBootPathFromRecord({
        device_profile: hydratedDevice.device_profile,
        device_type: hydratedDevice.device_type,
        restaurant_slug: restaurant?.slug ?? null,
    });

    // Set secure httpOnly cookies for device authentication
    // The token is also returned in the response body for backward compatibility
    // with existing clients that use localStorage/header-based auth
    const deviceMetadata: DeviceMetadata = {
        device_type: String(device.device_type),
        restaurant_id: String(device.restaurant_id),
        location_id: (device.location_id as string | null | undefined) ?? undefined,
        name: (device.name as string | null | undefined) ?? undefined,
        created_at: now,
        last_used_at: now,
    };
    await setDeviceTokenCookies(device_token, deviceMetadata);

    return apiSuccess(
        {
            device_token,
            restaurant_id: hydratedDevice.restaurant_id,
            location_id: hydratedDevice.location_id ?? null,
            device_type: hydratedDevice.device_type,
            device_profile: hydratedDevice.device_profile,
            name: hydratedDevice.name,
            assigned_zones: hydratedDevice.assigned_zones,
            metadata: gatewayAwareMetadata,
            boot_path,
            restaurant_slug: restaurant?.slug ?? null,
        },
        200
    );
}
