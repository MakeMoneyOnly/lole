import * as Sentry from '@sentry/nextjs';
import { restoreRestaurantContext } from './src/lib/monitoring/sentry-context';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Route all Sentry requests through the tunnel endpoint
    // This avoids ad blockers and provides better privacy
    tunnel: '/api/_sentry/tunnel',

    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    tracesSampleRate: 0.1,

    // Set sample rate for profiling to 0.1 (10%)
    // This is relative to tracesSampleRate
    profilesSampleRate: 0.1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Set environment
    environment: process.env.NODE_ENV || 'development',

    // Ignore specific errors
    ignoreErrors: [
        // Browser extensions
        'Non-Error promise rejection captured',
        // Network errors that are user-caused
        'NetworkError',
        'Network request failed',
        // Abort errors (common in React)
        'AbortError',
        // Cancelled requests
        'cancelled',
        // Chunk loading errors (network issues during lazy loading)
        'ChunkLoadError',
        'Loading chunk',
        // Hydration errors (React specific)
        'Hydration',
        'hydrating',
    ],

    // Configure replays
    // For POS routes, we want more context - keep text visible
    // For other routes, mask sensitive data
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
        Sentry.replayIntegration({
            // Mask text for privacy by default
            // POS routes will override this via browser SDK
            maskAllText: true,
            blockAllMedia: true,
        }),
        // Extra integrations for better error context
        Sentry.extraErrorDataIntegration(),
        Sentry.captureConsoleIntegration({
            levels: ['error', 'warn'],
        }),
    ],

    // beforeSend to tag errors with restaurant context
    beforeSend(event, _hint) {
        // Try to restore context from localStorage on every error
        // This ensures we have the latest context even after page refreshes
        restoreRestaurantContext();

        // Add URL context for debugging
        if (event.request?.url) {
            try {
                const url = new URL(event.request.url);
                // Tag the route for easy filtering
                event.tags = event.tags || {};
                event.tags.route = url.pathname;

                // Check if this is a POS or KDS route - these need more context
                const isPosOrKds =
                    url.pathname.includes('/pos/') ||
                    url.pathname.includes('/kds/') ||
                    url.pathname.includes('/terminal/');

                if (isPosOrKds) {
                    event.tags.device_type = url.pathname.split('/')[1];
                    // For POS/KDS, we want full context
                    // The POS routes should call setRestaurantContext() on mount
                }
            } catch {
                // Invalid URL, ignore
            }
        }

        return event;
    },

    // beforeSendTransaction for performance events
    beforeSendTransaction(event) {
        // Don't send health check transactions
        if (event.transaction?.includes('/api/health')) {
            return null;
        }
        return event;
    },
});

// Export context functions for use in app
export { setRestaurantContext, clearRestaurantContext } from './src/lib/monitoring/sentry-context';
