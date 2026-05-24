/**
 * Guest Session Management Service
 *
 * Provides secure session management for guest ordering via QR codes.
 * Uses HMAC-signed tokens for authentication without requiring account creation.
 *
 * Security Features:
 * - HMAC secret generated with crypto.randomBytes(32)
 * - Token expiry enforced server-side
 * - Session activity tracking (last_used_at)
 * - Auto-cleanup of expired sessions
 */

import { createClient } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';
import { generateHmacSecret, signPayload, verifySignature } from '@/lib/security/hmac';
import { logger } from '@/lib/logger';

// Type definitions matching the database schema
export interface CreateSessionParams {
    restaurantId: string;
    guestFingerprint: string;
    phone?: string;
    expiresInHours?: number;
}

export interface GuestSession {
    id: string;
    restaurant_id: string;
    guest_fingerprint: string;
    phone: string | null;
    hmac_secret: string;
    token: string;
    expires_at: Date;
    last_used_at: Date | null;
    created_at: Date;
}

export interface SessionValidationResult {
    valid: boolean;
    session?: GuestSession;
    error?: string;
}

// Default session expiry: 24 hours
const DEFAULT_SESSION_EXPIRY_HOURS = 24;

// Token prefix for identification
const TOKEN_PREFIX = 'session_';

/**
 * Create a Supabase admin client for server-side operations
 * Uses service role key to bypass RLS for internal operations
 */
function getSupabaseAdmin(): SupabaseClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !serviceKey) {
        throw new Error(
            'Supabase configuration missing. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY'
        );
    }

    return createClient(supabaseUrl, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Generate a URL-safe base64 encoded session token
 * Token format: session_{base64_url_safe(session_id:expires_at:signature)}
 */
function generateSessionToken(sessionId: string, expiresAt: Date, hmacSecret: string): string {
    const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);
    const payload = `${sessionId}:${expiresAtUnix}`;
    const signature = signPayload(payload, hmacSecret);

    // Create URL-safe base64
    const tokenData = Buffer.from(`${payload}:${signature}`).toString('base64url');

    return `${TOKEN_PREFIX}${tokenData}`;
}

/**
 * Parse a session token and extract its components
 */
function parseSessionToken(token: string): {
    sessionId: string;
    expiresAt: Date;
    signature: string;
} | null {
    if (!token.startsWith(TOKEN_PREFIX)) {
        return null;
    }

    const tokenData = token.slice(TOKEN_PREFIX.length);

    try {
        const decoded = Buffer.from(tokenData, 'base64url').toString('utf8');
        const parts = decoded.split(':');

        if (parts.length !== 3) {
            return null;
        }

        const [sessionId, expiresAtUnix, signature] = parts;
        const expiresAt = new Date(parseInt(expiresAtUnix, 10) * 1000);

        if (isNaN(expiresAt.getTime())) {
            return null;
        }

        return { sessionId, expiresAt, signature };
    } catch {
        return null;
    }
}

/**
 * Create a new guest session
 *
 * @param params - Session creation parameters
 * @returns GuestSession with generated token
 */
export async function createGuestSession(params: CreateSessionParams): Promise<GuestSession> {
    const {
        restaurantId,
        guestFingerprint,
        phone,
        expiresInHours = DEFAULT_SESSION_EXPIRY_HOURS,
    } = params;

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

    // Generate per-session HMAC secret
    const hmacSecret = generateHmacSecret();

    // Insert session into database
    const { data: session, error } = await supabase
        .from('guest_sessions')
        .insert({
            restaurant_id: restaurantId,
            guest_fingerprint: guestFingerprint,
            phone: phone || null,
            hmac_secret: hmacSecret,
            expires_at: expiresAt.toISOString(),
            last_used_at: now.toISOString(),
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, guest_fingerprint, phone, hmac_secret, expires_at, last_used_at, created_at'
        )
        .single();

    if (error) {
        logger.error('Failed to create guest session', {
            error: error.message,
            restaurantId,
            guestFingerprint,
        });
        throw new Error(`Failed to create guest session: ${error.message}`);
    }

    // Generate the session token
    const token = generateSessionToken(session.id, expiresAt, hmacSecret);

    // Return the full session object with token
    return {
        id: session.id,
        restaurant_id: session.restaurant_id,
        guest_fingerprint: session.guest_fingerprint,
        phone: session.phone,
        hmac_secret: session.hmac_secret,
        token,
        expires_at: new Date(session.expires_at),
        last_used_at: session.last_used_at ? new Date(session.last_used_at) : null,
        created_at: new Date(session.created_at),
    };
}

/**
 * Validate a session token
 *
 * @param token - The session token to validate
 * @returns SessionValidationResult with validation status and session if valid
 */
export async function validateSession(token: string): Promise<SessionValidationResult> {
    // Parse the token
    const parsed = parseSessionToken(token);
    if (!parsed) {
        return { valid: false, error: 'Invalid token format' };
    }

    // Check if token has expired
    if (new Date() > parsed.expiresAt) {
        return { valid: false, error: 'Session has expired' };
    }

    const supabase = getSupabaseAdmin();

    // Fetch the session from database
    // HIGH-013: Explicit column selection
    const { data: session, error } = await supabase
        .from('guest_sessions')
        .select(
            'id, restaurant_id, guest_fingerprint, phone, hmac_secret, expires_at, last_used_at, created_at'
        )
        .eq('id', parsed.sessionId)
        .single();

    if (error || !session) {
        return { valid: false, error: 'Session not found' };
    }

    // Verify the session hasn't expired in the database
    if (new Date(session.expires_at) < new Date()) {
        return { valid: false, error: 'Session has expired' };
    }

    // Verify the HMAC signature
    const payload = `${parsed.sessionId}:${Math.floor(parsed.expiresAt.getTime() / 1000)}`;
    if (!verifySignature(payload, parsed.signature, session.hmac_secret)) {
        logger.warn('Invalid session signature', { sessionId: parsed.sessionId });
        return { valid: false, error: 'Invalid signature' };
    }

    // Update last_used_at timestamp
    await supabase
        .from('guest_sessions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', parsed.sessionId);

    return {
        valid: true,
        session: {
            id: session.id,
            restaurant_id: session.restaurant_id,
            guest_fingerprint: session.guest_fingerprint,
            phone: session.phone,
            hmac_secret: session.hmac_secret,
            token,
            expires_at: new Date(session.expires_at),
            last_used_at: session.last_used_at ? new Date(session.last_used_at) : null,
            created_at: new Date(session.created_at),
        },
    };
}

/**
 * Refresh/extend a session's expiry time
 *
 * @param sessionId - The session ID to refresh
 * @param expiresInHours - New expiry time in hours (default: 24)
 * @returns Updated GuestSession
 */
export async function refreshSession(
    sessionId: string,
    expiresInHours: number = DEFAULT_SESSION_EXPIRY_HOURS
): Promise<GuestSession> {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + expiresInHours * 60 * 60 * 1000);

    const { data: session, error } = await supabase
        .from('guest_sessions')
        .update({
            expires_at: newExpiresAt.toISOString(),
            last_used_at: now.toISOString(),
        })
        .eq('id', sessionId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, guest_fingerprint, phone, hmac_secret, expires_at, last_used_at, created_at'
        )
        .single();

    if (error || !session) {
        logger.error('Failed to refresh session', { error: error?.message, sessionId });
        throw new Error(`Failed to refresh session: ${error?.message || 'Session not found'}`);
    }

    // Generate new token with extended expiry
    const token = generateSessionToken(session.id, newExpiresAt, session.hmac_secret);

    return {
        id: session.id,
        restaurant_id: session.restaurant_id,
        guest_fingerprint: session.guest_fingerprint,
        phone: session.phone,
        hmac_secret: session.hmac_secret,
        token,
        expires_at: new Date(session.expires_at),
        last_used_at: session.last_used_at ? new Date(session.last_used_at) : null,
        created_at: new Date(session.created_at),
    };
}

/**
 * Revoke a session (delete from database)
 *
 * @param sessionId - The session ID to revoke
 */
export async function revokeSession(sessionId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from('guest_sessions').delete().eq('id', sessionId);

    if (error) {
        logger.error('Failed to revoke session', { error: error.message, sessionId });
        throw new Error(`Failed to revoke session: ${error.message}`);
    }

    logger.info('Session revoked', { sessionId });
}

/**
 * Get an active session by restaurant and fingerprint
 * Returns the most recent active session if one exists
 *
 * @param restaurantId - Restaurant identifier
 * @param guestFingerprint - Guest device fingerprint
 * @returns GuestSession if found and active, null otherwise
 */
export async function getSessionByFingerprint(
    restaurantId: string,
    guestFingerprint: string
): Promise<GuestSession | null> {
    const supabase = getSupabaseAdmin();

    // HIGH-013: Explicit column selection
    const { data: session, error } = await supabase
        .from('guest_sessions')
        .select(
            'id, restaurant_id, guest_fingerprint, phone, hmac_secret, expires_at, last_used_at, created_at'
        )
        .eq('restaurant_id', restaurantId)
        .eq('guest_fingerprint', guestFingerprint)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !session) {
        return null;
    }

    // Generate the token for the session
    const token = generateSessionToken(
        session.id,
        new Date(session.expires_at),
        session.hmac_secret
    );

    return {
        id: session.id,
        restaurant_id: session.restaurant_id,
        guest_fingerprint: session.guest_fingerprint,
        phone: session.phone,
        hmac_secret: session.hmac_secret,
        token,
        expires_at: new Date(session.expires_at),
        last_used_at: session.last_used_at ? new Date(session.last_used_at) : null,
        created_at: new Date(session.created_at),
    };
}

/**
 * Clean up expired sessions
 * Should be called periodically to maintain database hygiene
 *
 * @param olderThanHours - Delete sessions older than this many hours (default: 168 hours / 7 days)
 * @returns Number of deleted sessions
 */
export async function cleanupExpiredSessions(olderThanHours: number = 168): Promise<number> {
    const supabase = getSupabaseAdmin();
    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    const { data, error } = await supabase
        .from('guest_sessions')
        .delete()
        .lt('expires_at', cutoffDate.toISOString())
        .select('id');

    if (error) {
        logger.error('Failed to cleanup expired sessions', { error: error.message });
        throw new Error(`Failed to cleanup sessions: ${error.message}`);
    }

    const deletedCount = data?.length || 0;
    if (deletedCount > 0) {
        logger.info('Cleaned up expired sessions', { deletedCount });
    }

    return deletedCount;
}
