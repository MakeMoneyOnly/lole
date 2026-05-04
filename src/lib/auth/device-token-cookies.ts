import { cookies } from 'next/headers';
import { createHmac } from 'crypto';

const DEVICE_TOKEN_COOKIE_NAME = 'geb_device_token';
const DEVICE_TOKEN_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
};

function getTokenSignatureSecret(): string {
    const secret = process.env.DEVICE_TOKEN_SIGNATURE_SECRET || process.env.AUTH_SECRET;

    if (!secret) {
        throw new Error(
            'DEVICE_TOKEN_SIGNATURE_SECRET is required. ' +
                'Set it to a random 64-character hex string. ' +
                "Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }

    if (secret.length < 32) {
        throw new Error(
            `DEVICE_TOKEN_SIGNATURE_SECRET must be at least 32 characters (got ${secret.length})`
        );
    }

    if (process.env.NODE_ENV !== 'production' && secret.includes('development-secret')) {
        throw new Error('DEVICE_TOKEN_SIGNATURE_SECRET must not use placeholder values');
    }

    return secret;
}

const TOKEN_SIGNATURE_SECRET = getTokenSignatureSecret();

export interface DeviceMetadata {
    device_type?: string;
    restaurant_id?: string;
    location_id?: string;
    name?: string;
    created_at?: string;
    last_used_at?: string;
}

interface VerifyDeviceTokenResult {
    valid: boolean;
    token?: string;
    metadata?: DeviceMetadata;
}

export async function setDeviceTokenCookies(
    token: string,
    metadata: DeviceMetadata
): Promise<void> {
    const cookieStore = await cookies();
    const signature = createHmac('sha256', TOKEN_SIGNATURE_SECRET)
        .update(`${token}:${JSON.stringify(metadata)}`)
        .digest('hex');

    cookieStore.set(DEVICE_TOKEN_COOKIE_NAME, token, {
        ...DEVICE_TOKEN_COOKIE_OPTIONS,
    });

    cookieStore.set(`${DEVICE_TOKEN_COOKIE_NAME}_metadata`, JSON.stringify(metadata), {
        ...DEVICE_TOKEN_COOKIE_OPTIONS,
    });

    cookieStore.set(`${DEVICE_TOKEN_COOKIE_NAME}_signature`, signature, {
        ...DEVICE_TOKEN_COOKIE_OPTIONS,
    });
}

export function verifyDeviceTokenFromRequest(request: Request): VerifyDeviceTokenResult {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) {
        return { valid: false };
    }

    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
            const [key, ...value] = c.trim().split('=');
            return [key, value.join('=')];
        })
    );

    const token = cookies[DEVICE_TOKEN_COOKIE_NAME];
    const metadataStr = cookies[`${DEVICE_TOKEN_COOKIE_NAME}_metadata`];
    const signature = cookies[`${DEVICE_TOKEN_COOKIE_NAME}_signature`];

    if (!token || !metadataStr || !signature) {
        return { valid: false };
    }

    const expectedSignature = createHmac('sha256', TOKEN_SIGNATURE_SECRET)
        .update(`${token}:${metadataStr}`)
        .digest('hex');

    if (signature !== expectedSignature) {
        return { valid: false };
    }

    let metadata: DeviceMetadata;
    try {
        metadata = JSON.parse(metadataStr);
    } catch {
        return { valid: false };
    }

    return {
        valid: true,
        token,
        metadata,
    };
}
