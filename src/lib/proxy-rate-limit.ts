import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

export interface ProxyRateLimitConfig {
    limit: number;
    windowSeconds: number;
    keyPrefix?: string;
}

interface ProxyRateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}

const RATE_LIMITS = {
    mutations: {
        limit: 10,
        windowSeconds: 60,
        keyPrefix: 'rl:mut',
    } as ProxyRateLimitConfig,
    auth: {
        limit: 5,
        windowSeconds: 60,
        keyPrefix: 'rl:auth',
    } as ProxyRateLimitConfig,
    reads: {
        limit: 60,
        windowSeconds: 60,
        keyPrefix: 'rl:read',
    } as ProxyRateLimitConfig,
};

const ENDPOINT_CATEGORIES: Array<{ pattern: RegExp; config: ProxyRateLimitConfig }> = [
    {
        pattern: /^\/api\/(v1\/)?(auth|staff\/verify-pin|staff\/add-pin|staff\/invite)/,
        config: RATE_LIMITS.auth,
    },
    {
        pattern: /^\/api\/v1\/(merchant|pos)\/.*\/(pair|provision|verify-pin)/,
        config: RATE_LIMITS.auth,
    },
    { pattern: /^\/api\/v1\/guest-portal\/(verify-contact|session)/, config: RATE_LIMITS.auth },
    {
        pattern: /^\/api\/(v1\/)?(merchant\/operations\/|pos\/device\/)?orders(\/|$)/,
        config: RATE_LIMITS.mutations,
    },
    {
        pattern: /^\/api\/(v1\/)?(merchant\/operations\/)?payments(\/|$)/,
        config: RATE_LIMITS.mutations,
    },
    {
        pattern: /^\/api\/(v1\/)?(merchant\/operations\/|pos\/device\/)?table-sessions(\/|$)/,
        config: RATE_LIMITS.mutations,
    },
    {
        pattern: /^\/api\/v1\/pos\/device\/tables\/(ensure-open-session|close|bill-request)/,
        config: RATE_LIMITS.mutations,
    },
    {
        pattern: /^\/api\/(v1\/)?(merchant\/operations\/)?kds\/.*\/action/,
        config: RATE_LIMITS.mutations,
    },
    {
        pattern: /^\/api\/v1\/merchant\/operations\/kds\/(handoff|print)/,
        config: RATE_LIMITS.mutations,
    },
    { pattern: /^\/api\/(v1\/)?(merchant\/core\/)?settings(\/|$)/, config: RATE_LIMITS.mutations },
    {
        pattern: /^\/api\/(v1\/)?(merchant\/insights\/)?(analytics|metrics|api-metrics)(\/|$)/,
        config: RATE_LIMITS.reads,
    },
    { pattern: /^\/api\/v1\/system\/(sync|health|jobs)(\/|$)/, config: RATE_LIMITS.mutations },
    { pattern: /^\/api\/v1\/guest-portal\//, config: RATE_LIMITS.mutations },
];

class InMemoryProxyRateLimitStore {
    private store = new Map<string, { count: number; windowStart: number }>();

    get(key: string, windowSeconds: number): number {
        const now = Date.now();
        const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);
        const fullKey = `${key}:${windowStart}`;
        return this.store.get(fullKey)?.count ?? 0;
    }

    increment(key: string, windowSeconds: number): { count: number; reset: number } {
        const now = Date.now();
        const windowStart = Math.floor(now / (windowSeconds * 1000)) * (windowSeconds * 1000);
        const fullKey = `${key}:${windowStart}`;
        const nextCount = (this.store.get(fullKey)?.count ?? 0) + 1;

        this.store.set(fullKey, {
            count: nextCount,
            windowStart,
        });

        this.cleanup(now);

        return {
            count: nextCount,
            reset: Math.ceil((windowStart + windowSeconds * 1000) / 1000),
        };
    }

    private cleanup(now: number): void {
        const threshold = now - 60 * 60 * 1000;
        for (const [key, entry] of this.store.entries()) {
            if (entry.windowStart < threshold) {
                this.store.delete(key);
            }
        }
    }
}

const proxyMemoryStore = new InMemoryProxyRateLimitStore();

async function getClientIP(request: NextRequest): Promise<string> {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    const realIP = request.headers.get('x-real-ip');
    if (realIP) {
        return realIP;
    }

    const userAgent = request.headers.get('user-agent') || '';
    const acceptLang = request.headers.get('accept-language') || '';
    const data = new TextEncoder().encode(`${userAgent}:${acceptLang}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fingerprint = hashArray
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 16);
    return `fp-${fingerprint}`;
}

function getRateLimitConfig(path: string, method: string): ProxyRateLimitConfig | null {
    const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method.toUpperCase());
    if (!isMutation) {
        return null;
    }

    for (const { pattern, config } of ENDPOINT_CATEGORIES) {
        if (pattern.test(path)) {
            return config;
        }
    }

    if (path.startsWith('/api/')) {
        return RATE_LIMITS.mutations;
    }

    return null;
}

async function checkProxyRateLimit(
    request: NextRequest,
    config: ProxyRateLimitConfig
): Promise<ProxyRateLimitResult> {
    const clientIP = await getClientIP(request);
    const path = request.nextUrl.pathname;
    const key = `${config.keyPrefix || 'rl'}:${clientIP}:${path}`;
    const currentCount = proxyMemoryStore.get(key, config.windowSeconds);

    if (currentCount >= config.limit) {
        const now = Date.now();
        const windowStart =
            Math.floor(now / (config.windowSeconds * 1000)) * (config.windowSeconds * 1000);
        return {
            success: false,
            limit: config.limit,
            remaining: 0,
            reset: Math.ceil((windowStart + config.windowSeconds * 1000) / 1000),
        };
    }

    const result = proxyMemoryStore.increment(key, config.windowSeconds);
    return {
        success: true,
        limit: config.limit,
        remaining: Math.max(0, config.limit - result.count),
        reset: result.reset,
    };
}

export async function proxyRateLimitMiddleware(request: NextRequest): Promise<NextResponse | null> {
    const path = request.nextUrl.pathname;
    const method = request.method;
    const config = getRateLimitConfig(path, method);

    if (!config) {
        return null;
    }

    const result = await checkProxyRateLimit(request, config);

    if (result.success) {
        return null;
    }

    const clientIp = await getClientIP(request);
    logger.warn('Proxy rate limit exceeded', {
        action: 'proxy_rate_limit:exceeded',
        clientIp,
        endpoint: path,
        limit: config.limit,
        windowSeconds: config.windowSeconds,
    });

    return NextResponse.json(
        {
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests. Please try again later.',
                retryAfter: result.reset - Math.floor(Date.now() / 1000),
            },
        },
        {
            status: 429,
            headers: {
                'X-RateLimit-Limit': result.limit.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': result.reset.toString(),
                'Retry-After': (result.reset - Math.floor(Date.now() / 1000)).toString(),
            },
        }
    );
}
