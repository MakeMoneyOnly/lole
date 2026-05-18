/**
 * Session Management
 *
 * Addresses PLATFORM_AUDIT_REPORT finding SEC-H2: No Session Timeout
 * Implements secure session management with timeout and activity tracking
 *
 * Updated: Feb 16, 2026 - Redis-backed session storage with memory fallback
 */

import {
    getSessionStore,
    getMemoryStore,
    initializeSessionStore,
    isUsingRedis,
    closeSessionStore,
    type SessionData,
    type SessionStore,
} from './sessionStore';

// Re-export types
export type { SessionData, SessionStore };
export { initializeSessionStore, isUsingRedis, closeSessionStore };

// Constants
const SESSION_TIMEOUT_SECONDS = 30 * 60; // 30 minutes in seconds
const MAX_SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const ACTIVITY_THRESHOLD_MS = 5 * 60 * 1000; // Check every 5 minutes

/**
 * Create a new session
 */
export async function createSession(
    sessionId: string,
    userId: string,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, unknown>
): Promise<void> {
    const store = getSessionStore();
    const now = Date.now();

    const sessionData: SessionData = {
        userId,
        lastActivity: now,
        createdAt: now,
        ipAddress,
        userAgent,
        metadata,
    };

    await store.set(sessionId, sessionData, SESSION_TIMEOUT_SECONDS);
}

/**
 * Update session activity
 */
export async function updateSessionActivity(sessionId: string): Promise<boolean> {
    const store = getSessionStore();
    return store.updateActivity(sessionId);
}

/**
 * Validate session - checks if session exists and hasn't expired
 */
export async function validateSession(
    sessionId: string
): Promise<{ valid: boolean; reason?: string }> {
    const store = getSessionStore();
    const session = await store.get(sessionId);

    if (!session) {
        return { valid: false, reason: 'Session not found' };
    }

    const now = Date.now();

    // Check if session has exceeded max lifetime (8 hours)
    if (now - session.createdAt > MAX_SESSION_LIFETIME_MS) {
        await store.delete(sessionId);
        return { valid: false, reason: 'Session exceeded maximum lifetime' };
    }

    // Check if session has expired due to inactivity
    if (now - session.lastActivity > SESSION_TIMEOUT_SECONDS * 1000) {
        await store.delete(sessionId);
        return { valid: false, reason: 'Session expired due to inactivity' };
    }

    // Update last activity
    await store.updateActivity(sessionId);

    return { valid: true };
}

/**
 * Get session data
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
    const store = getSessionStore();
    return store.get(sessionId);
}

/**
 * Destroy session (logout)
 */
export async function destroySession(sessionId: string): Promise<void> {
    const store = getSessionStore();
    await store.delete(sessionId);
}

/**
 * Get time until session expires
 */
export async function getSessionTimeRemaining(sessionId: string): Promise<number> {
    const store = getSessionStore();
    const session = await store.get(sessionId);

    if (!session) return 0;

    const expiresAt = session.lastActivity + SESSION_TIMEOUT_SECONDS * 1000;
    return Math.max(0, expiresAt - Date.now());
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
    const store = getSessionStore();
    if (store.cleanup) {
        return store.cleanup();
    }
    return 0;
}

/**
 * Check if session is from the same device/IP
 * (Basic fraud detection)
 */
export async function validateSessionContext(
    sessionId: string,
    ipAddress: string,
    userAgent: string
): Promise<{ valid: boolean; reason?: string }> {
    const store = getSessionStore();
    const session = await store.get(sessionId);

    if (!session) {
        return { valid: false, reason: 'Session not found' };
    }

    // Check if IP has changed (could indicate session hijacking)
    if (session.ipAddress !== ipAddress) {
        console.warn(`Session ${sessionId} IP mismatch: ${session.ipAddress} vs ${ipAddress}`);
    }

    // Check if user agent has changed significantly
    if (session.userAgent !== userAgent) {
        console.warn(`Session ${sessionId} User-Agent mismatch`);
    }

    return { valid: true };
}

/**
 * Extend session timeout
 * Call this when user performs an action to keep session alive
 */
export async function extendSession(sessionId: string): Promise<boolean> {
    const store = getSessionStore();
    const validation = await validateSession(sessionId);

    if (!validation.valid) return false;

    return store.updateActivity(sessionId);
}

/**
 * Update session metadata
 */
export async function updateSessionMetadata(
    sessionId: string,
    metadata: Record<string, unknown>
): Promise<boolean> {
    const store = getSessionStore();
    const session = await store.get(sessionId);

    if (!session) return false;

    session.metadata = { ...session.metadata, ...metadata };
    await store.set(sessionId, session, SESSION_TIMEOUT_SECONDS);

    return true;
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<string[]> {
    const store = getSessionStore();

    if (!store.getAllSessionIds) {
        return [];
    }

    const allSessionIds = await store.getAllSessionIds();
    const userSessions: string[] = [];

    for (const sessionId of allSessionIds) {
        const session = await store.get(sessionId);
        if (session && session.userId === userId) {
            userSessions.push(sessionId);
        }
    }

    return userSessions;
}

/**
 * Destroy all sessions for a user (logout from all devices)
 */
export async function destroyUserSessions(userId: string): Promise<number> {
    const sessionIds = await getUserSessions(userId);
    let destroyed = 0;

    for (const sessionId of sessionIds) {
        await destroySession(sessionId);
        destroyed++;
    }

    return destroyed;
}

// ============================================
// LEGACY SYNC METHODS (for backward compatibility)
// These use the in-memory store only
// ============================================

/**
 * @deprecated Use createSession() instead
 * Legacy sync method for backward compatibility
 */
export function createSessionSync(
    sessionId: string,
    userId: string,
    ipAddress: string,
    userAgent: string
): void {
    const store = getMemoryStore();
    const now = Date.now();

    store.setSync(sessionId, {
        userId,
        lastActivity: now,
        createdAt: now,
        ipAddress,
        userAgent,
    });
}

/**
 * @deprecated Use validateSession() instead
 * Legacy sync method for backward compatibility
 */
export function validateSessionSync(sessionId: string): { valid: boolean; reason?: string } {
    const store = getMemoryStore();
    const session = store.getSync(sessionId);

    if (!session) {
        return { valid: false, reason: 'Session not found' };
    }

    const now = Date.now();

    if (now - session.createdAt > MAX_SESSION_LIFETIME_MS) {
        return { valid: false, reason: 'Session exceeded maximum lifetime' };
    }

    if (now - session.lastActivity > SESSION_TIMEOUT_SECONDS * 1000) {
        return { valid: false, reason: 'Session expired due to inactivity' };
    }

    return { valid: true };
}

/**
 * @deprecated Use getSession() instead
 * Legacy sync method for backward compatibility
 */
export function getSessionSync(sessionId: string): SessionData | null {
    const store = getMemoryStore();
    return store.getSync(sessionId);
}

/**
 * @deprecated Use destroySession() instead
 * Legacy sync method for backward compatibility
 */
export function destroySessionSync(sessionId: string): void {
    const store = getMemoryStore();
    store.delete(sessionId);
}

// Auto-cleanup interval (runs in background)
if (typeof setInterval !== 'undefined') {
    setInterval(async () => {
        await cleanupExpiredSessions();
    }, ACTIVITY_THRESHOLD_MS);
}

const sessionExports = {
    createSession,
    validateSession,
    getSession,
    destroySession,
    updateSessionActivity,
    getSessionTimeRemaining,
    cleanupExpiredSessions,
    validateSessionContext,
    extendSession,
    updateSessionMetadata,
    getUserSessions,
    destroyUserSessions,
    initializeSessionStore,
    isUsingRedis,
    closeSessionStore,
};

export default sessionExports;
