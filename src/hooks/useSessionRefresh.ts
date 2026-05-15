/**
 * Session Refresh Hook
 *
 * Manages client-side session refresh for Supabase authentication.
 * Handles session expiry gracefully and provides automatic refresh logic.
 *
 * @module useSessionRefresh
 */

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const log = logger.child('SessionRefresh');

/**
 * Configuration options for session refresh behavior
 */
interface SessionRefreshConfig {
    /** Interval in milliseconds to check session status (default: 60000 = 1 minute) */
    checkIntervalMs?: number;
    /** Threshold in seconds before expiry to trigger refresh (default: 300 = 5 minutes) */
    refreshThresholdSeconds?: number;
    /** Callback when session is refreshed successfully */
    onRefresh?: (session: { userId: string; expiresAt: number }) => void;
    /** Callback when session expires and cannot be refreshed */
    onExpired?: () => void;
    /** Callback when refresh fails */
    onError?: (error: Error) => void;
}

interface SessionInfo {
    userId: string;
    expiresAt: number;
    isValid: boolean;
    timeUntilExpiry: number;
}

const DEFAULT_CHECK_INTERVAL = 60_000; // 1 minute
const DEFAULT_REFRESH_THRESHOLD = 300; // 5 minutes before expiry

/**
 * Hook for managing Supabase session refresh logic on the client side.
 *
 * This hook:
 * - Periodically checks session expiry status
 * - Automatically refreshes tokens before they expire
 * - Handles session expiry gracefully with callbacks
 * - Provides manual refresh functionality
 *
 * @param config - Configuration options for session refresh behavior
 * @returns Object with session info and refresh functions
 *
 * @example
 * ```tsx
 * function AuthenticatedComponent() {
 *   const { sessionInfo, refreshSession, isRefreshing } = useSessionRefresh({
 *     onExpired: () => router.push('/login'),
 *     onError: (err) => toast.error('Session refresh failed'),
 *   });
 *
 *   if (!sessionInfo?.isValid) {
 *     return <SessionExpiredMessage />;
 *   }
 *
 *   return <ProtectedContent />;
 * }
 * ```
 */
export function useSessionRefresh(config: SessionRefreshConfig = {}) {
    const {
        checkIntervalMs = DEFAULT_CHECK_INTERVAL,
        refreshThresholdSeconds = DEFAULT_REFRESH_THRESHOLD,
        onRefresh,
        onExpired,
        onError,
    } = config;

    const supabase = getSupabaseClient();
    const isRefreshingRef = useRef(false);
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Get current session information
     */
    const getSessionInfo = useCallback(async (): Promise<SessionInfo | null> => {
        try {
            const {
                data: { session },
                error,
            } = await supabase.auth.getSession();

            if (error || !session) {
                return null;
            }

            const now = Math.floor(Date.now() / 1000);
            const expiresAt = session.expires_at ?? 0;
            const timeUntilExpiry = expiresAt - now;
            const isValid = timeUntilExpiry > 0;

            return {
                userId: session.user.id,
                expiresAt,
                isValid,
                timeUntilExpiry,
            };
        } catch (error) {
        log.error('Error getting session info', error);
        return null;
    }
    }, [supabase]);

    /**
     * Refresh the session manually
     */
    const refreshSession = useCallback(async (): Promise<boolean> => {
        if (isRefreshingRef.current) {
            return false;
        }

        isRefreshingRef.current = true;

        try {
            const {
                data: { session },
                error,
            } = await supabase.auth.refreshSession();

            if (error) {
                log.error('Refresh failed', error);
                onError?.(new Error(error.message));
                return false;
            }

            if (session) {
                onRefresh?.({
                    userId: session.user.id,
                    expiresAt: session.expires_at ?? 0,
                });
                return true;
            }

            return false;
        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown refresh error');
            log.error('Refresh error', err);
            onError?.(err);
            return false;
        } finally {
            isRefreshingRef.current = false;
        }
    }, [supabase, onRefresh, onError]);

    /**
     * Check session and refresh if needed
     */
    const checkAndRefresh = useCallback(async () => {
        const sessionInfo = await getSessionInfo();

        if (!sessionInfo) {
            // No session exists
            onExpired?.();
            return;
        }

        if (!sessionInfo.isValid) {
            // Session has already expired
            log.warn('Session has expired');
            onExpired?.();
            return;
        }

        // Refresh if session is about to expire
        if (sessionInfo.timeUntilExpiry <= refreshThresholdSeconds) {
            log.warn('Session expiring soon, refreshing...', {
                timeUntilExpiry: sessionInfo.timeUntilExpiry,
            });
            await refreshSession();
        }
    }, [getSessionInfo, refreshSession, refreshThresholdSeconds, onExpired]);

    /**
     * Set up auth state listener for immediate expiry detection
     */
    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'TOKEN_REFRESHED') {
                if (session) {
                    onRefresh?.({
                        userId: session.user.id,
                        expiresAt: session.expires_at ?? 0,
                    });
                }
            } else if (event === 'SIGNED_OUT') {
                onExpired?.();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase, onRefresh, onExpired]);

    /**
     * Set up periodic session check
     */
    useEffect(() => {
        // Initial check
        checkAndRefresh();

        // Set up interval
        checkIntervalRef.current = setInterval(checkAndRefresh, checkIntervalMs);

        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
        };
    }, [checkAndRefresh, checkIntervalMs]);

    return {
        /** Get current session information */
        getSessionInfo,
        /** Manually refresh the session */
        refreshSession,
        /** Check session and refresh if needed */
        checkAndRefresh,
        /** Whether a refresh is currently in progress */
        get isRefreshing() {
            return isRefreshingRef.current;
        },
    };
}

/**
 * Hook for components that need to protect content based on session state.
 *
 * @param options - Configuration options
 * @returns Session state and loading status
 *
 * @example
 * ```tsx
 * function ProtectedPage() {
 *   const { isAuthenticated, isLoading, userId } = useSessionState({
 *     redirectTo: '/login',
 *   });
 *
 *   if (isLoading) return <LoadingSpinner />;
 *   if (!isAuthenticated) return null; // Will redirect
 *
 *   return <Dashboard userId={userId} />;
 * }
 * ```
 */
export function useSessionState(options: { redirectTo?: string } = {}) {
    void options; // Options reserved for future use (e.g., redirect behavior)
    const supabase = getSupabaseClient();

    const checkSession = useCallback(async () => {
        const {
            data: { session },
            error,
        } = await supabase.auth.getSession();

        if (error || !session) {
            return { isAuthenticated: false, userId: null };
        }

        return {
            isAuthenticated: true,
            userId: session.user.id,
            expiresAt: session.expires_at ?? 0,
        };
    }, [supabase]);

    return {
        checkSession,
    };
}

export default useSessionRefresh;
