/**
 * Sensitive Action Confirmation Tokens
 *
 * Addresses SEC-003: Add sensitive-action confirmation tokens
 * Provides CSRF-like protection for high-risk operations
 */

import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Actions that require confirmation tokens
 */
export type SensitiveAction =
    | 'delete_restaurant'
    | 'delete_staff'
    | 'change_role'
    | 'transfer_ownership'
    | 'delete_menu_item'
    | 'void_order'
    | 'refund_payment'
    | 'close_register'
    | 'export_data'
    | 'reset_integration';

/**
 * Confirmation token payload
 */
export interface ConfirmationToken {
    action: SensitiveAction;
    resourceId: string;
    userId: string;
    restaurantId: string;
    expiresAt: number;
}

/**
 * Token expiration time in milliseconds (5 minutes)
 */
const TOKEN_EXPIRATION_MS = 5 * 60 * 1000;

/**
 * Get the secret key for signing tokens
 */
function getSigningSecret(): string {
    const secret = process.env.HMAC_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('HMAC_SECRET or JWT_SECRET is required for confirmation tokens');
    }
    return secret;
}

/**
 * Generate a confirmation token for a sensitive action
 */
export function generateConfirmationToken(
    action: SensitiveAction,
    resourceId: string,
    userId: string,
    restaurantId: string
): { token: string; expiresAt: number } {
    const expiresAt = Date.now() + TOKEN_EXPIRATION_MS;
    const nonce = randomBytes(16).toString('hex');

    const payload = `${action}:${resourceId}:${userId}:${restaurantId}:${expiresAt}:${nonce}`;
    const signature = createHmac('sha256', getSigningSecret()).update(payload).digest('hex');

    const token = Buffer.from(
        JSON.stringify({
            action,
            resourceId,
            userId,
            restaurantId,
            expiresAt,
            nonce,
            signature,
        })
    ).toString('base64url');

    return { token, expiresAt };
}

/**
 * Verify a confirmation token
 */
export function verifyConfirmationToken(
    token: string,
    expectedAction: SensitiveAction,
    expectedUserId: string,
    expectedRestaurantId: string
): { valid: boolean; reason?: string; resourceId?: string } {
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));

        const { action, resourceId, userId, restaurantId, expiresAt, nonce, signature } =
            decoded as ConfirmationToken & { nonce: string; signature: string };

        // Check expiration
        if (Date.now() > expiresAt) {
            return { valid: false, reason: 'Confirmation token has expired' };
        }

        // Verify action matches
        if (action !== expectedAction) {
            return { valid: false, reason: 'Invalid action for confirmation token' };
        }

        // Verify user matches
        if (userId !== expectedUserId) {
            return { valid: false, reason: 'Confirmation token does not belong to current user' };
        }

        // Verify restaurant matches
        if (restaurantId !== expectedRestaurantId) {
            return {
                valid: false,
                reason: 'Confirmation token does not belong to current restaurant',
            };
        }

        // Verify signature
        const payload = `${action}:${resourceId}:${userId}:${restaurantId}:${expiresAt}:${nonce}`;
        const expectedSignature = createHmac('sha256', getSigningSecret())
            .update(payload)
            .digest('hex');

        const signatureBuffer = Buffer.from(signature, 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');

        if (
            signatureBuffer.length !== expectedBuffer.length ||
            !timingSafeEqual(signatureBuffer, expectedBuffer)
        ) {
            return { valid: false, reason: 'Invalid confirmation token signature' };
        }

        return { valid: true, resourceId };
    } catch (_error) {
        return { valid: false, reason: 'Invalid confirmation token format' };
    }
}

/**
 * Higher-order function to wrap sensitive actions with confirmation
 */
export function withConfirmation<TArgs extends unknown[], TResult>(
    action: SensitiveAction,
    handler: (resourceId: string, ...args: TArgs) => Promise<TResult>,
    getResourceId: (...args: TArgs) => string
) {
    return async (
        confirmationToken: string,
        userId: string,
        restaurantId: string,
        ...args: TArgs
    ): Promise<TResult> => {
        const resourceId = getResourceId(...args);

        const verification = verifyConfirmationToken(
            confirmationToken,
            action,
            userId,
            restaurantId
        );

        if (!verification.valid) {
            throw new Error(`Confirmation failed: ${verification.reason}`);
        }

        if (verification.resourceId !== resourceId) {
            throw new Error('Confirmation token resource ID mismatch');
        }

        return handler(resourceId, ...args);
    };
}

/**
 * Generate a one-time password for sensitive actions (alternative to tokens)
 */
export function generateConfirmationOTP(
    action: SensitiveAction,
    resourceId: string,
    userId: string
): string {
    const secret = getSigningSecret();
    const timeSlot = Math.floor(Date.now() / 60000); // Changes every minute
    const payload = `${action}:${resourceId}:${userId}:${timeSlot}`;

    const hash = createHmac('sha256', secret).update(payload).digest('hex');

    // Take first 6 characters as OTP
    return hash.slice(0, 6).toUpperCase();
}

/**
 * Verify a confirmation OTP
 */
export function verifyConfirmationOTP(
    otp: string,
    action: SensitiveAction,
    resourceId: string,
    userId: string
): boolean {
    // Check current time slot and previous time slot (allows 1 minute drift)
    const currentTimeSlot = Math.floor(Date.now() / 60000);

    for (let i = 0; i <= 1; i++) {
        const timeSlot = currentTimeSlot - i;
        const secret = getSigningSecret();
        const payload = `${action}:${resourceId}:${userId}:${timeSlot}`;

        const hash = createHmac('sha256', secret).update(payload).digest('hex');

        const expectedOTP = hash.slice(0, 6).toUpperCase();

        if (timingSafeEqual(Buffer.from(otp), Buffer.from(expectedOTP))) {
            return true;
        }
    }

    return false;
}

const confirmationTokenExports = {
    generateConfirmationToken,
    verifyConfirmationToken,
    withConfirmation,
    generateConfirmationOTP,
    verifyConfirmationOTP,
};

export default confirmationTokenExports;
