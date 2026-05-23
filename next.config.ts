import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    // Enable offline fallback
    fallbacks: {
        image: '/offline', // Will use offline page
        document: '/offline', // Offline page for navigation failures
        // App shell fallback for critical routes
        app: '/offline',
    },
    // Additional PWA settings
    reloadOnOnline: true,
    swcMinify: true,
    // Handle navigation requests when offline
    navigateFallback: '/offline',
    navigateFallbackAllowlist: [/^\/(?!api).*/],
    runtimeCaching: [
        {
            // Cache the restaurant and menu data for offline browsing
            urlPattern: /^https:\/\/.*\/api\/(?:restaurant|menu)\/.*/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'api-data',
                expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 24 * 60 * 60, // 24 hours
                },
                networkTimeoutSeconds: 5,
                cacheableResponse: {
                    statuses: [0, 200],
                },
            },
        },
        {
            // GraphQL API caching - NetworkFirst with cache fallback
            urlPattern: /^https:\/\/.*\/api\/graphql.*/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'graphql-api',
                expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 60 * 60, // 1 hour
                },
                networkTimeoutSeconds: 10,
                cacheableResponse: {
                    statuses: [0, 200],
                },
            },
        },
        {
            // Orders API - NetworkFirst with longer cache for offline
            urlPattern: /^https:\/\/.*\/api\/orders.*/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'orders-api',
                expiration: {
                    maxEntries: 200,
                    maxAgeSeconds: 12 * 60 * 60, // 12 hours
                },
                networkTimeoutSeconds: 5,
                cacheableResponse: {
                    statuses: [0, 200],
                },
            },
        },
        {
            // Menu images - CacheFirst for long-term caching
            urlPattern:
                /^https:\/\/.*(?:unsplash\.com|supabase\.co)\/.*(?:png|jpg|jpeg|webp|svg|gif|avif).*$/i,
            handler: 'CacheFirst',
            options: {
                cacheName: 'menu-images',
                expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
                cacheableResponse: {
                    statuses: [0, 200],
                },
            },
        },
        // Cache standard Google Fonts
        {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
                cacheName: 'google-fonts',
                expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                },
                cacheableResponse: {
                    statuses: [0, 200],
                },
            },
        },
        // Use StaleWhileRevalidate for local static assets
        {
            urlPattern: /\.(?:js|css|woff2?|png|jpg|jpeg|webp|svg|gif)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-assets',
                expiration: {
                    maxEntries: 500,
                    maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
                },
            },
        },
        // Prefetch critical pages for offline access
        {
            urlPattern: /^https?:\/\/(?:localhost|.*\.vercel\.app)\/$/i,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'app-shell',
                expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 24 * 60 * 60, // 24 hours
                },
                networkTimeoutSeconds: 5,
            },
        },
        // Fallback to NetworkFirst for everything else
        {
            urlPattern: /^https?.*/,
            handler: 'NetworkFirst',
            options: {
                cacheName: 'offline-fallback',
                expiration: {
                    maxEntries: 200,
                    maxAgeSeconds: 24 * 60 * 60, // 24 hours
                },
                networkTimeoutSeconds: 10,
                cacheableResponse: {
                    statuses: [0, 200],
                },
            },
        },
    ],
});

const nextConfig: NextConfig = {
    reactStrictMode: true,
    turbopack: {},

    cacheComponents: true,

    // Performance: Enable experimental features for better optimization
    experimental: {
        // Optimize package imports to reduce bundle size
        optimizePackageImports: [
            'lucide-react',
            'recharts',
            'framer-motion',
            '@react-three/drei',
            '@react-three/fiber',
            'three',
        ],
    },

    images: {
        unoptimized: process.env.CI === 'true',
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [320, 420, 768, 1024, 1200],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'plus.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: '**.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: 'i.pravatar.cc',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'api.dicebear.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'hoirqrkdgbmvpwutwuwj.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'https',
                hostname: 'via.placeholder.com',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
                pathname: '/**',
            },
        ],
        dangerouslyAllowSVG: true,
        contentDispositionType: 'inline',
    },

    // API Versioning: Rewrite /api/v1/* to /api/* for versioned API endpoints
    // This allows clients to use /api/v1/orders instead of /api/orders
    async rewrites() {
        return [
            {
                // Rewrite /api/v1/* to /api/*
                source: '/api/v1/:path*',
                destination: '/api/:path*',
            },
            {
                // Sentry tunnel - proxy Sentry requests through the app
                // Avoids ad blockers and provides better privacy
                source: '/api/_sentry/tunnel',
                destination: '/api/_sentry/tunnel',
            },
        ];
    },

    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    // Performance: Preconnect to critical external domains
                    {
                        key: 'Link',
                        value: [
                            '<https://fonts.googleapis.com>; rel=preconnect',
                            '<https://fonts.gstatic.com>; rel=preconnect; crossorigin',
                            '<https://images.unsplash.com>; rel=preconnect',
                            '<https://axuegixbqsvztdraenkz.supabase.co>; rel=preconnect',
                            '<https://api.dicebear.com>; rel=preconnect',
                        ].join(', '),
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value:
                            process.env.NODE_ENV === 'production'
                                ? 'max-age=63072000; includeSubDomains; preload'
                                : 'max-age=0',
                    },
                    {
                        key: 'X-DNS-Prefetch-Control',
                        value: 'on',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    // Note: CSP is handled in middleware.ts for consistency
                    // and to avoid duplicate header issues
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                ],
            },
        ];
    },
};

export default withBundleAnalyzer({
    enabled: process.env.ANALYZE === 'true',
})(withPWA(nextConfig));
