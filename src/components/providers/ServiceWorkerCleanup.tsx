'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

/**
 * Component that cleans up service workers in development mode.
 * This prevents stale service workers from interfering with fetch requests
 * and causing "Failed to fetch" errors during development.
 */
export function ServiceWorkerCleanup(): React.JSX.Element | null {
    useEffect(() => {
        // Only run in development and in browser
        if (process.env.NODE_ENV !== 'development') return;
        if (typeof window === 'undefined' || !navigator.serviceWorker) return;

        const cleanupServiceWorkers = async (): Promise<void> => {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();

                if (registrations.length > 0) {
                    logger.warn(
                        `[ServiceWorkerCleanup] Unregistering ${registrations.length} service worker(s) in development mode`
                    );

                    for (const registration of registrations) {
                        await registration.unregister();
                    }
                }

                // Also clear any cached service worker data
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    for (const cacheName of cacheNames) {
                        // Only clear PWA-related caches in development
                        if (
                            cacheName.includes('workbox') ||
                            cacheName.includes('sw-') ||
                            cacheName.includes('next-pwa') ||
                            cacheName.includes('api-data') ||
                            cacheName.includes('menu-images') ||
                            cacheName.includes('static-assets') ||
                            cacheName.includes('offline-fallback')
                        ) {
                            await caches.delete(cacheName);
                            logger.warn(`[ServiceWorkerCleanup] Cleared cache: ${cacheName}`);
                        }
                    }
                }
            } catch (error) {
                // Silently fail - this is just a cleanup operation
                logger.warn('[ServiceWorkerCleanup] Cleanup skipped:', { error });
            }
        };

        cleanupServiceWorkers();
    }, []);

    return null;
}
