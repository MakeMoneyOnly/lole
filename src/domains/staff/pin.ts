import { createHmac, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

const HASH_PREFIX = 'h1:';
const BCRYPT_WORK_FACTOR = 10;
const DEFAULT_PIN_SECRET = 'local-dev-staff-pin-secret';
const DEFAULT_SESSION_TTL_MINUTES = 8 * 60;

function resolveStaffPinSecret(): string {
    return (
        process.env.STAFF_PIN_SECRET ??
        process.env.HMAC_SECRET ??
        process.env.NEXTAUTH_SECRET ??
        DEFAULT_PIN_SECRET
    );
}

function toBuffer(value: string): Buffer {
    return Buffer.from(value, 'utf8');
}

export function hashStaffPin(pin: string): string {
    const digest = createHmac('sha256', resolveStaffPinSecret()).update(pin.trim()).digest('hex');
    return `${HASH_PREFIX}${digest}`;
}

export function isHashedStaffPin(value: string | null | undefined): value is string {
    return typeof value === 'string' && /^h1:[a-f0-9]{64}$/.test(value);
}

export function verifyStoredStaffPin(
    storedPin: string | null | undefined,
    candidatePin: string
): boolean {
    if (!storedPin) {
        return false;
    }

    if (!isHashedStaffPin(storedPin)) {
        return storedPin === candidatePin.trim();
    }

    const expected = toBuffer(storedPin);
    const actual = toBuffer(hashStaffPin(candidatePin));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function buildStaffSessionExpiry(
    issuedAt: string = new Date().toISOString(),
    ttlMinutes: number = Number(
        process.env.STAFF_PIN_SESSION_TTL_MINUTES ?? DEFAULT_SESSION_TTL_MINUTES
    )
): string {
    const ttlMs = Math.max(1, ttlMinutes) * 60_000;
    return new Date(new Date(issuedAt).getTime() + ttlMs).toISOString();
}

// Bcrypt-based PIN hashing for new implementations
export async function hashStaffPinBcrypt(pin: string): Promise<string> {
    return bcrypt.hash(pin.trim(), BCRYPT_WORK_FACTOR);
}

export function isBcryptHashedPin(value: string | null | undefined): value is string {
    return typeof value === 'string' && /^\$2[aby]\$\d{2}\$.{53}$/.test(value);
}

export async function verifyStoredStaffPinBcrypt(
    storedPin: string | null | undefined,
    candidatePin: string
): Promise<boolean> {
    if (!storedPin) {
        return false;
    }

    // Handle bcrypt hashes
    if (isBcryptHashedPin(storedPin)) {
        return bcrypt.compare(candidatePin.trim(), storedPin);
    }

    // Handle legacy HMAC hashes for backward compatibility
    if (isHashedStaffPin(storedPin)) {
        const expected = toBuffer(storedPin);
        const actual = toBuffer(hashStaffPin(candidatePin));
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    }

    // Legacy plaintext comparison (for unhashed values)
    return storedPin === candidatePin.trim();
}
