import { randomInt, randomUUID } from 'crypto';
import { z } from 'zod';
import {
    DEVICE_PAIRING_CODE_LENGTH,
    DeviceProfileSchema,
    ManagementProviderSchema,
    PrinterConnectionTypeSchema,
    type DeviceProfile,
    type HardwareDeviceType,
    getBootPathForDeviceProfile,
    resolveDeviceProfile,
} from '@/lib/devices/config';

export { DEVICE_PAIRING_CODE_LENGTH } from '@/lib/devices/config';

const PAIRING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const DevicePairPrinterSchema = z
    .object({
        connection_type: PrinterConnectionTypeSchema.optional(),
        device_id: z.string().trim().max(120).optional(),
        device_name: z.string().trim().max(120).optional(),
        mac_address: z.string().trim().max(64).optional(),
    })
    .optional();

export const PairDeviceSchema = z.object({
    code: z.string().trim().min(4).max(12).optional(),
    pairing_code: z.string().trim().min(4).max(12).optional(),
    device_uuid: z.string().trim().min(8).max(120).optional(),
    app_version: z.string().trim().max(40).optional(),
    platform: z.string().trim().max(40).optional(),
    profile_hint: DeviceProfileSchema.optional(),
    printer: DevicePairPrinterSchema,
});

export type PairDeviceRequest = z.infer<typeof PairDeviceSchema>;

export const ProvisionDeviceSchema = z.object({
    name: z.string().trim().min(2).max(120),
    device_type: z.enum(['pos', 'kds', 'kiosk', 'digital_menu', 'terminal']).optional(),
    device_profile: DeviceProfileSchema.optional(),
    location_id: z.string().uuid().optional(),
    assigned_zones: z.array(z.string()).optional(),
    management_provider: ManagementProviderSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ProvisionDeviceRequest = z.infer<typeof ProvisionDeviceSchema>;

export function normalizePairingCode(value: string): string {
    return value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 12);
}

export function generatePairingCode(length: number = DEVICE_PAIRING_CODE_LENGTH): string {
    return Array.from({ length }, () => {
        const index = randomInt(0, PAIRING_ALPHABET.length);
        return PAIRING_ALPHABET[index];
    }).join('');
}

export function buildPairingExpiry(minutes: number = 15): string {
    return new Date(Date.now() + minutes * 60_000).toISOString();
}

export function generateDeviceToken(): string {
    return randomUUID();
}

export function resolveProvisionedDeviceShape(input: ProvisionDeviceRequest): {
    deviceType: HardwareDeviceType;
    deviceProfile: DeviceProfile;
} {
    const deviceProfile = input.device_profile ?? resolveDeviceProfile(input.device_type ?? 'pos');
    const deviceType =
        input.device_type ??
        (deviceProfile === 'cashier'
            ? 'terminal'
            : deviceProfile === 'kds'
              ? 'kds'
              : deviceProfile === 'kiosk'
                ? 'kiosk'
                : 'pos');

    return {
        deviceType,
        deviceProfile,
    };
}

export function getDeviceBootPathFromRecord(record: {
    device_profile?: string | null;
    device_type?: string | null;
    restaurant_slug?: string | null;
}): string {
    const profile = DeviceProfileSchema.safeParse(record.device_profile).success
        ? (record.device_profile as DeviceProfile)
        : resolveDeviceProfile((record.device_type as HardwareDeviceType) ?? 'pos');

    return getBootPathForDeviceProfile(profile, record.restaurant_slug);
}
