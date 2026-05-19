'use client';

import { useState, useCallback } from 'react';

/**
 * Prevents skeleton loaders from re-appearing on tab-switch / minimize-restore.
 *
 * Usage:
 *   const { loading, setLoading, markLoaded } = usePageLoadGuard('staff');
 *
 * - On the very first visit: loading = true  → show skeleton
 * - On all subsequent mounts in the same session: loading = false → render stale data instantly
 * - Call markLoaded() after your initial fetch completes to persist the flag
 *
 * The flag is stored in sessionStorage so it clears when the tab is closed.
 */
export function usePageLoadGuard(pageKey: string): {
    loading: boolean;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    markLoaded: () => void;
} {
    const storageKey = `page.initialLoadDone.${pageKey}`;

    const [loading, setLoading] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        return sessionStorage.getItem(storageKey) !== '1';
    });

    const markLoaded = useCallback(() => {
        try {
            sessionStorage.setItem(storageKey, '1');
        } catch {
            // sessionStorage unavailable — degrade gracefully
        }
        setLoading(false);
    }, [storageKey]);

    return { loading, setLoading, markLoaded };
}
