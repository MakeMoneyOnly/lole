import {
    DeviceProfileSchema,
    type DeviceProfile,
    type HardwareDeviceMetadata,
    type HardwareDeviceType,
    resolveDeviceProfile,
} from '@/lib/devices/config';

const ENTERPRISE_DEVICE_SCHEMA_ERROR_PATTERN =
    /device_profile|pairing_state|pairing_code_expires_at|management_provider|management_status|location_id|pairing_completed_at|hardware_fingerprint|printer_connection_type|printer_device_id|printer_device_name|printer_mac_address|fiscal_mode|ota_status|target_app_version|ota_requested_at|ota_completed_at|ota_error|column .* does not exist|schema cache/i;

export type EnterpriseShellMetadata = {
    device_profile?: DeviceProfile | null;
    location_id?: string | null;
    pairing_state?: 'ready' | 'paired' | 'revoked' | 'expired' | null;
    pairing_code_expires_at?: string | null;
    pairing_completed_at?: string | null;
    management_provider?: 'none' | 'esper' | null;
    management_status?: 'unmanaged' | 'managed' | 'pending' | 'error' | null;
    management_device_id?: string | null;
    hardware_fingerprint?: string | null;
};

type MaybeRecord = Record<string, unknown> | null | undefined;

function asRecord(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

export function isEnterpriseDeviceSchemaError(message?: string | null): boolean {
    return ENTERPRISE_DEVICE_SCHEMA_ERROR_PATTERN.test(message ?? '');
}

export function readEnterpriseShellMetadata(
    metadata: MaybeRecord,
    deviceType: HardwareDeviceType = 'pos'
): Required<EnterpriseShellMetadata> {
    const raw = asRecord(metadata);
    const shell = asRecord(raw?.enterprise_shell);
    const parsedProfile = DeviceProfileSchema.safeParse(shell?.device_profile);

    return {
        device_profile: parsedProfile.success
            ? parsedProfile.data
            : resolveDeviceProfile(deviceType),
        location_id:
            typeof shell?.location_id === 'string' && shell.location_id.trim()
                ? shell.location_id
                : null,
        pairing_state:
            shell?.pairing_state === 'ready' ||
            shell?.pairing_state === 'paired' ||
            shell?.pairing_state === 'revoked' ||
            shell?.pairing_state === 'expired'
                ? shell.pairing_state
                : 'ready',
        pairing_code_expires_at:
            typeof shell?.pairing_code_expires_at === 'string'
                ? shell.pairing_code_expires_at
                : null,
        pairing_completed_at:
            typeof shell?.pairing_completed_at === 'string' ? shell.pairing_completed_at : null,
        management_provider:
            shell?.management_provider === 'esper' || shell?.management_provider === 'none'
                ? shell.management_provider
                : 'none',
        management_status:
            shell?.management_status === 'managed' ||
            shell?.management_status === 'pending' ||
            shell?.management_status === 'error' ||
            shell?.management_status === 'unmanaged'
                ? shell.management_status
                : 'unmanaged',
        management_device_id:
            typeof shell?.management_device_id === 'string' ? shell.management_device_id : null,
        hardware_fingerprint:
            typeof shell?.hardware_fingerprint === 'string' ? shell.hardware_fingerprint : null,
    };
}

export function mergeEnterpriseShellMetadata(
    metadata: HardwareDeviceMetadata | Record<string, unknown> | undefined,
    shell: EnterpriseShellMetadata
): Record<string, unknown> {
    const base = asRecord(metadata) ?? {};
    const currentShell = asRecord(base.enterprise_shell) ?? {};

    return {
        ...base,
        enterprise_shell: {
            ...currentShell,
            ...Object.fromEntries(Object.entries(shell).filter(([, value]) => value !== undefined)),
        },
    };
}

export function hydrateEnterpriseDeviceRecord<
    T extends {
        device_type?: string | null;
        device_profile?: string | null;
        metadata?: Record<string, unknown> | null;
        location_id?: string | null;
        pairing_state?: string | null;
        pairing_code_expires_at?: string | null;
        pairing_completed_at?: string | null;
        management_provider?: string | null;
        management_device_id?: string | null;
    },
>(
    record: T
): T & {
    device_profile: DeviceProfile;
    location_id: string | null;
    pairing_state: 'ready' | 'paired' | 'revoked' | 'expired';
    pairing_code_expires_at: string | null;
    pairing_completed_at: string | null;
    management_provider: 'none' | 'esper';
    management_device_id: string | null;
} {
    const deviceType =
        record.device_type === 'terminal' ||
        record.device_type === 'kds' ||
        record.device_type === 'kiosk' ||
        record.device_type === 'digital_menu'
            ? record.device_type
            : 'pos';
    const fallback = readEnterpriseShellMetadata(record.metadata, deviceType);
    const parsedProfile = DeviceProfileSchema.safeParse(record.device_profile);

    const pairingState =
        record.pairing_state === 'ready' ||
        record.pairing_state === 'paired' ||
        record.pairing_state === 'revoked' ||
        record.pairing_state === 'expired'
            ? record.pairing_state
            : fallback.pairing_state;

    const managementProvider =
        record.management_provider === 'esper' || record.management_provider === 'none'
            ? record.management_provider
            : fallback.management_provider;

    return {
        ...record,
        device_profile: parsedProfile.success ? parsedProfile.data : fallback.device_profile,
        location_id: record.location_id ?? fallback.location_id,
        pairing_state: pairingState,
        pairing_code_expires_at: record.pairing_code_expires_at ?? fallback.pairing_code_expires_at,
        pairing_completed_at: record.pairing_completed_at ?? fallback.pairing_completed_at,
        management_provider: managementProvider,
        management_device_id: record.management_device_id ?? fallback.management_device_id,
    } as T & {
        device_profile: DeviceProfile;
        location_id: string | null;
        pairing_state: 'ready' | 'paired' | 'revoked' | 'expired';
        pairing_code_expires_at: string | null;
        pairing_completed_at: string | null;
        management_provider: 'none' | 'esper';
        management_device_id: string | null;
    };
}
