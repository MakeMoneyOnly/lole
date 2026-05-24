export interface CacheOptions {
    maxAge: number;
    staleWhileRevalidate?: number;
    isPublic?: boolean;
}

export function getCacheHeaders(options: CacheOptions): HeadersInit {
    const { maxAge, staleWhileRevalidate, isPublic = false } = options;

    const directives = [isPublic ? 'public' : 'private', `max-age=${maxAge}`];

    if (staleWhileRevalidate) {
        directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
    }

    return {
        'Cache-Control': directives.join(', '),
    };
}

export const CACHE_PRESETS = {
    dashboard: { maxAge: 30, staleWhileRevalidate: 60, isPublic: false },
    analytics: { maxAge: 60, staleWhileRevalidate: 120, isPublic: false },
    menu: { maxAge: 300, staleWhileRevalidate: 600, isPublic: true },
    tables: { maxAge: 15, staleWhileRevalidate: 30, isPublic: false },
    static: { maxAge: 3600, staleWhileRevalidate: 7200, isPublic: true },
} as const;
