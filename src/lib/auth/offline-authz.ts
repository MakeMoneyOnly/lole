import type { DeviceProfile, HardwareDeviceType } from '@/lib/devices/config';

export type GatewayCapability =
    | 'gateway.bootstrap'
    | 'terminal.read'
    | 'terminal.split.manage'
    | 'terminal.payment.capture'
    | 'terminal.table.close'
    | 'kds.queue.read'
    | 'kds.settings.read'
    | 'kds.settings.write'
    | 'orders.write'
    | 'tables.write';

export interface OfflineDeviceAuthorization {
    capabilities: GatewayCapability[];
    ttlMinutes: number;
}

export type OfflineStaffOutageMode = 'blocked' | 'supervised' | 'local-only';

export interface OfflineStaffOutagePolicy {
    mode: OfflineStaffOutageMode;
    ttlMinutes: number;
    requiresRecentPin: boolean;
    allowedRoles: string[];
    issuedAt?: string;
}

export interface OfflineStaffAccessResult {
    allowed: boolean;
    reason: string | null;
    expiresAt: string | null;
}

type UnknownRecord = Record<string, unknown>;

function uniqueCapabilities(capabilities: GatewayCapability[]): GatewayCapability[] {
    return [...new Set(capabilities)];
}

export function buildOfflineDeviceAuthorization(input: {
    deviceType: HardwareDeviceType;
    deviceProfile?: DeviceProfile | null;
}): OfflineDeviceAuthorization {
    const profile = input.deviceProfile ?? null;

    if (input.deviceType === 'terminal' || profile === 'cashier') {
        return {
            capabilities: uniqueCapabilities([
                'gateway.bootstrap',
                'terminal.read',
                'terminal.split.manage',
                'terminal.payment.capture',
                'terminal.table.close',
                'orders.write',
                'tables.write',
            ]),
            ttlMinutes: 12 * 60,
        };
    }

    if (input.deviceType === 'kds' || profile === 'kds') {
        return {
            capabilities: uniqueCapabilities([
                'gateway.bootstrap',
                'kds.queue.read',
                'kds.settings.read',
                'kds.settings.write',
                'orders.write',
            ]),
            ttlMinutes: 12 * 60,
        };
    }

    if (input.deviceType === 'kiosk' || profile === 'kiosk') {
        return {
            capabilities: uniqueCapabilities(['gateway.bootstrap']),
            ttlMinutes: 4 * 60,
        };
    }

    return {
        capabilities: uniqueCapabilities(['gateway.bootstrap', 'orders.write', 'tables.write']),
        ttlMinutes: 8 * 60,
    };
}

export function hasGatewayCapability(
    capabilities: GatewayCapability[],
    capability: GatewayCapability
): boolean {
    return capabilities.includes(capability);
}

function asRecord(value: unknown): UnknownRecord | null {
    return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function readGatewayIdentity(metadata: Record<string, unknown> | null): UnknownRecord | null {
    const parsedMetadata = asRecord(metadata);
    return parsedMetadata ? asRecord(parsedMetadata.gateway_identity) : null;
}

function parseRoleList(value: unknown): string[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
        : [];
}

export function resolveGatewayIdentityVersion(metadata: Record<string, unknown> | null): number {
    const gatewayIdentity = readGatewayIdentity(metadata);
    const version = gatewayIdentity?.version;
    return typeof version === 'number' && Number.isFinite(version) && version >= 1
        ? Math.floor(version)
        : 1;
}

export function isGatewayIdentityRevoked(metadata: Record<string, unknown> | null): boolean {
    const revokedAt = readGatewayIdentity(metadata)?.revoked_at;
    return typeof revokedAt === 'string' && revokedAt.length > 0;
}

export function buildGatewayIdentityMetadata(
    metadata: Record<string, unknown> | null,
    nowIso: string
): Record<string, unknown> {
    const nextVersion = resolveGatewayIdentityVersion(metadata);

    return {
        ...(metadata ?? {}),
        gateway_identity: {
            version: nextVersion,
            issued_at: nowIso,
            rotated_at: nowIso,
            revoked_at: null,
        },
    };
}

export function rotateGatewayIdentityMetadata(
    metadata: Record<string, unknown> | null,
    nowIso: string
): Record<string, unknown> {
    return {
        ...(metadata ?? {}),
        gateway_identity: {
            ...(readGatewayIdentity(metadata) ?? {}),
            version: resolveGatewayIdentityVersion(metadata) + 1,
            issued_at: nowIso,
            rotated_at: nowIso,
            revoked_at: null,
        },
    };
}

export function revokeGatewayIdentityMetadata(
    metadata: Record<string, unknown> | null,
    nowIso: string
): Record<string, unknown> {
    return {
        ...(metadata ?? {}),
        gateway_identity: {
            ...(readGatewayIdentity(metadata) ?? {}),
            version: resolveGatewayIdentityVersion(metadata),
            revoked_at: nowIso,
        },
    };
}

export function buildOfflineStaffOutagePolicy(input: {
    deviceType: HardwareDeviceType;
    deviceProfile?: DeviceProfile | null;
}): OfflineStaffOutagePolicy {
    const profile = input.deviceProfile ?? null;

    if (input.deviceType === 'terminal' || profile === 'cashier') {
        return {
            mode: 'supervised',
            ttlMinutes: 12 * 60,
            requiresRecentPin: true,
            allowedRoles: ['owner', 'manager', 'cashier'],
        };
    }

    if (input.deviceType === 'kds' || profile === 'kds') {
        return {
            mode: 'local-only',
            ttlMinutes: 24 * 60,
            requiresRecentPin: false,
            allowedRoles: ['owner', 'manager', 'chef', 'kds'],
        };
    }

    if (input.deviceType === 'kiosk' || profile === 'kiosk') {
        return {
            mode: 'blocked',
            ttlMinutes: 0,
            requiresRecentPin: false,
            allowedRoles: [],
        };
    }

    return {
        mode: 'supervised',
        ttlMinutes: 8 * 60,
        requiresRecentPin: true,
        allowedRoles: ['owner', 'manager', 'waiter'],
    };
}

export function buildOfflineStaffOutagePolicyMetadata(input: {
    metadata: Record<string, unknown> | null;
    deviceType: HardwareDeviceType;
    deviceProfile?: DeviceProfile | null;
    nowIso: string;
}): Record<string, unknown> {
    const policy = buildOfflineStaffOutagePolicy({
        deviceType: input.deviceType,
        deviceProfile: input.deviceProfile ?? null,
    });

    return {
        ...(input.metadata ?? {}),
        outage_policy: {
            mode: policy.mode,
            ttl_minutes: policy.ttlMinutes,
            issued_at: input.nowIso,
            requires_recent_pin: policy.requiresRecentPin,
            allowed_roles: policy.allowedRoles,
        },
    };
}

export function resolveOfflineStaffOutagePolicy(
    metadata: Record<string, unknown> | null,
    fallback: {
        deviceType: HardwareDeviceType;
        deviceProfile?: DeviceProfile | null;
    }
): OfflineStaffOutagePolicy {
    const rawPolicy = asRecord(asRecord(metadata)?.outage_policy);
    if (!rawPolicy) {
        return buildOfflineStaffOutagePolicy(fallback);
    }

    const base = buildOfflineStaffOutagePolicy(fallback);
    const mode = rawPolicy.mode;
    const ttlMinutes = rawPolicy.ttl_minutes;
    const issuedAt = rawPolicy.issued_at;
    const requiresRecentPin = rawPolicy.requires_recent_pin;

    return {
        mode:
            mode === 'blocked' || mode === 'supervised' || mode === 'local-only' ? mode : base.mode,
        ttlMinutes:
            typeof ttlMinutes === 'number' && Number.isFinite(ttlMinutes) && ttlMinutes >= 0
                ? Math.floor(ttlMinutes)
                : base.ttlMinutes,
        issuedAt: typeof issuedAt === 'string' && issuedAt.length > 0 ? issuedAt : undefined,
        requiresRecentPin:
            typeof requiresRecentPin === 'boolean' ? requiresRecentPin : base.requiresRecentPin,
        allowedRoles: parseRoleList(rawPolicy.allowed_roles).length
            ? parseRoleList(rawPolicy.allowed_roles)
            : base.allowedRoles,
    };
}

export function evaluateOfflineStaffAccess(input: {
    policy: OfflineStaffOutagePolicy;
    isOnline: boolean;
    now?: string;
    role?: string | null;
    lastPinVerifiedAt?: string | null;
}): OfflineStaffAccessResult {
    if (input.isOnline) {
        return { allowed: true, reason: null, expiresAt: null };
    }

    if (input.policy.mode === 'blocked') {
        return {
            allowed: false,
            reason: 'Offline staff access blocked for this device.',
            expiresAt: null,
        };
    }

    const issuedAt = input.policy.issuedAt ? new Date(input.policy.issuedAt).getTime() : Date.now();
    const expiresAtMs = issuedAt + input.policy.ttlMinutes * 60 * 1000;
    const nowMs = input.now ? new Date(input.now).getTime() : Date.now();
    const expiresAt = input.policy.ttlMinutes > 0 ? new Date(expiresAtMs).toISOString() : null;

    if (input.policy.ttlMinutes <= 0 || expiresAtMs < nowMs) {
        return { allowed: false, reason: 'Offline staff access expired.', expiresAt };
    }

    if (
        input.role &&
        input.policy.allowedRoles.length > 0 &&
        !input.policy.allowedRoles.includes(input.role)
    ) {
        return { allowed: false, reason: 'Staff role not allowed during outage.', expiresAt };
    }

    if (input.policy.requiresRecentPin && !input.lastPinVerifiedAt) {
        return { allowed: false, reason: 'Recent staff PIN required for outage mode.', expiresAt };
    }

    return { allowed: true, reason: null, expiresAt };
}
