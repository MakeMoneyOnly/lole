import { createHmac, timingSafeEqual } from 'crypto';
import type { DeviceProfile, HardwareDeviceType } from '@/lib/devices/config';
import type { GatewayCapability, OfflineStaffOutagePolicy } from '@/lib/auth/offline-authz';

export interface GatewaySessionClaims {
    sub: string;
    iss: string;
    aud: string;
    iat: number;
    exp: number;
    alg: string;
    kid: string;
    deviceId: string;
    restaurantId: string;
    locationId: string;
    gatewayId: string;
    deviceType: HardwareDeviceType;
    deviceProfile: DeviceProfile | null;
    identityVersion: number;
    authorizations: GatewayCapability[];
    topicPrefix: string;
    issuedAt: string;
    expiresAt: string;
    offlineAccessExpiresAt: string;
    staffOutagePolicy: OfflineStaffOutagePolicy;
}

export interface GatewaySessionBundle {
    token: string;
    claims: GatewaySessionClaims;
    username: string;
    password: string;
}

interface GatewaySecretEntry {
    kid: string;
    secret: string;
    active: boolean;
}

function parseGatewaySecrets(raw: string): GatewaySecretEntry[] {
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            const result = parsed
                .filter(
                    (e): e is { kid: string; secret: string; active?: boolean } =>
                        typeof e === 'object' &&
                        e !== null &&
                        typeof e.kid === 'string' &&
                        typeof e.secret === 'string'
                )
                .map(e => ({
                    kid: e.kid,
                    secret: e.secret,
                    active: e.active !== false,
                }));
            if (result.length > 0) {
                return result;
            }
        }
    } catch {
        // Not valid JSON — fall through to legacy parsing
    }

    // Legacy format: single "kid:secret" pairs comma-separated
    return raw
        .split(',')
        .map(entry => {
            const idx = entry.indexOf(':');
            if (idx === -1) {
                return { kid: 'v1', secret: entry.trim(), active: true };
            }
            const kid = entry.substring(0, idx).trim();
            const secret = entry.substring(idx + 1).trim();
            return kid && secret
                ? { kid, secret, active: true }
                : { kid: 'v1', secret: entry.trim(), active: true };
        })
        .filter(e => e.kid && e.secret);
}

function getGatewaySessionSecrets(): GatewaySecretEntry[] {
    const rawSecrets = process.env.GATEWAY_SESSION_SECRETS;

    if (rawSecrets) {
        const secrets = parseGatewaySecrets(rawSecrets);
        if (secrets.length === 0) {
            throw new Error(
                'GATEWAY_SESSION_SECRETS is set but could not be parsed. ' +
                    'Use JSON: [{"kid":"v1","secret":"...","active":true}] or ' +
                    'legacy format: "v1:secret1,v2:secret2"'
            );
        }
        return secrets;
    }

    const legacySecret = process.env.GATEWAY_SESSION_SECRET;
    if (legacySecret) {
        if (legacySecret.length < 32) {
            throw new Error('GATEWAY_SESSION_SECRET must be at least 32 characters');
        }
        return [{ kid: 'v1', secret: legacySecret, active: true }];
    }

    if (process.env.NODE_ENV === 'test') {
        return [{ kid: 'test', secret: 'test-gateway-session-secret-32chars!!', active: true }];
    }

    throw new Error(
        'GATEWAY_SESSION_SECRETS or GATEWAY_SESSION_SECRET is required for gateway session issuance'
    );
}

function getActiveSecret(): GatewaySecretEntry {
    const secrets = getGatewaySessionSecrets();
    const active = secrets.filter(s => s.active);
    if (active.length === 0) {
        throw new Error('No active gateway session secrets configured');
    }
    return active[active.length - 1];
}

function getSecretByKid(kid: string): GatewaySecretEntry | null {
    const secrets = getGatewaySessionSecrets();
    return secrets.find(s => s.kid === kid && s.active) ?? null;
}

function toBase64Url(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
}

function signPayload(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function issueGatewaySessionToken(input: {
    deviceId: string;
    restaurantId: string;
    locationId: string;
    gatewayId: string;
    deviceType?: HardwareDeviceType;
    deviceProfile?: DeviceProfile | null;
    identityVersion?: number;
    authorizations?: GatewayCapability[];
    expiresInMinutes?: number;
    offlineAccessExpiresAt?: string;
    staffOutagePolicy?: OfflineStaffOutagePolicy;
}): GatewaySessionBundle {
    const activeSecret = getActiveSecret();
    const issuedAt = new Date();
    const iatSec = Math.floor(issuedAt.getTime() / 1000);
    const expiresAt = new Date(issuedAt.getTime() + (input.expiresInMinutes ?? 60) * 60 * 1000);
    const expSec = Math.floor(expiresAt.getTime() / 1000);
    const claims: GatewaySessionClaims = {
        sub: input.deviceId,
        iss: input.gatewayId,
        aud: 'lole-store',
        iat: iatSec,
        exp: expSec,
        alg: 'HS256',
        kid: activeSecret.kid,
        deviceId: input.deviceId,
        restaurantId: input.restaurantId,
        locationId: input.locationId,
        gatewayId: input.gatewayId,
        deviceType: input.deviceType ?? 'pos',
        deviceProfile: input.deviceProfile ?? null,
        identityVersion: input.identityVersion ?? 1,
        authorizations: input.authorizations ?? ['gateway.bootstrap'],
        topicPrefix: `lole/v1/restaurants/${input.restaurantId}/locations/${input.locationId}`,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        offlineAccessExpiresAt: input.offlineAccessExpiresAt ?? expiresAt.toISOString(),
        staffOutagePolicy: input.staffOutagePolicy ?? {
            mode: 'blocked',
            ttlMinutes: 0,
            requiresRecentPin: false,
            allowedRoles: [],
        },
    };

    const encodedClaims = toBase64Url(JSON.stringify(claims));
    const signature = signPayload(encodedClaims, activeSecret.secret);
    const token = `${encodedClaims}.${signature}`;

    return {
        token,
        claims,
        username: input.deviceId,
        password: token,
    };
}

export function verifyGatewaySessionToken(token: string): GatewaySessionClaims | null {
    const [encodedClaims, providedSignature] = token.split('.');
    if (!encodedClaims || !providedSignature) {
        return null;
    }

    let kid: string | null = null;
    try {
        const decoded = JSON.parse(
            Buffer.from(encodedClaims, 'base64url').toString('utf8')
        ) as Partial<GatewaySessionClaims>;
        kid = decoded.kid ?? null;

        if (typeof decoded.exp === 'number') {
            const nowSec = Math.floor(Date.now() / 1000);
            if (decoded.exp < nowSec) {
                return null;
            }
        }
    } catch {
        return null;
    }

    let signatureValid = false;

    if (kid) {
        const secretEntry = getSecretByKid(kid);
        if (secretEntry) {
            const expectedSignature = signPayload(encodedClaims, secretEntry.secret);
            const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
            const providedBuffer = Buffer.from(providedSignature, 'base64url');
            if (
                expectedBuffer.length === providedBuffer.length &&
                timingSafeEqual(expectedBuffer, providedBuffer)
            ) {
                signatureValid = true;
            }
        }
    }

    if (!signatureValid) {
        const allSecrets = getGatewaySessionSecrets().filter(s => s.active);
        for (const secretEntry of allSecrets) {
            const expectedSignature = signPayload(encodedClaims, secretEntry.secret);
            const expectedBuffer = Buffer.from(expectedSignature, 'base64url');
            const providedBuffer = Buffer.from(providedSignature, 'base64url');
            if (
                expectedBuffer.length === providedBuffer.length &&
                timingSafeEqual(expectedBuffer, providedBuffer)
            ) {
                signatureValid = true;
                break;
            }
        }
    }

    if (!signatureValid) {
        return null;
    }

    try {
        const claims = JSON.parse(
            Buffer.from(encodedClaims, 'base64url').toString('utf8')
        ) as GatewaySessionClaims;
        return claims;
    } catch {
        return null;
    }
}
