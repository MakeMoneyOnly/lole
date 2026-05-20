import * as Sentry from '@sentry/nextjs';
import { restoreRestaurantContext } from '@/lib/monitoring/sentry-context';

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    debug: false,
    environment: process.env.NODE_ENV || 'development',

    ignoreErrors: [
        'Non-Error promise rejection captured',
        'NetworkError',
        'Network request failed',
        'AbortError',
        'cancelled',
        'ChunkLoadError',
        'Loading chunk',
        'Hydration',
        'hydrating',
    ],

    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
        }),
        Sentry.extraErrorDataIntegration(),
        Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
    ],

    beforeSend(event, _hint) {
        restoreRestaurantContext();
        if (event.request?.url) {
            try {
                const url = new URL(event.request.url);
                event.tags = event.tags || {};
                event.tags.route = url.pathname;
                const isPosOrKds =
                    url.pathname.includes('/pos/') ||
                    url.pathname.includes('/kds/') ||
                    url.pathname.includes('/terminal/');
                if (isPosOrKds) {
                    event.tags.device_type = url.pathname.split('/')[1];
                }
            } catch {
                // Invalid URL, ignore
            }
        }
        return event;
    },

    beforeSendTransaction(event) {
        if (event.transaction?.includes('/api/health')) {
            return null;
        }
        return event;
    },
});

export { setRestaurantContext, clearRestaurantContext } from '@/lib/monitoring/sentry-context';
