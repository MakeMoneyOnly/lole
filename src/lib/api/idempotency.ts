import { randomUUID } from 'crypto';

export function resolveIdempotencyKey(explicitKey?: string | null): string {
    if (explicitKey && explicitKey.trim().length > 0) {
        return explicitKey.trim();
    }
    return randomUUID();
}

export function isIdempotencyKeyValid(key: string | null | undefined): boolean {
    if (!key) {
        return false;
    }
    // UUID v4 format accepted for now.
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
}
