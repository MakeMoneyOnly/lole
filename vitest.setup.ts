import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Set required environment variables for tests
process.env.QR_HMAC_SECRET = 'test_secret_key_for_testing_purposes_only_32b';
process.env.HMAC_SECRET = 'test_hmac_secret_for_testing_purposes_only_32b';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-anon-key-for-testing';
process.env.SUPABASE_SECRET_KEY = 'test-service-role-key-for-testing';
process.env.REDIS_URL = '';
process.env.DEVICE_TOKEN_SIGNATURE_SECRET = 'test-secret-key-that-is-long-enough-32ch';

// Mock bcryptjs before any imports that use it
vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn(async (pin: string) => {
            // Generate a properly formatted bcrypt hash: exactly 60 chars
            // $2b$10$ + 53 chars (22 salt + 31 hash)
            const hash = `$2b$10$eWmWcJN1zOaNmQcQhQhQhOeWmWcJN1zOaNmQcQhQhQhO123456789`;
            return hash;
        }),
        compare: vi.fn(async (pin: string, hash: string) => {
            // Simple mock: return true if pin is '1234' and hash looks valid
            return pin === '1234' && hash.startsWith('$2');
        }),
    },
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
    getSupabaseClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            single: vi.fn(),
            maybeSingle: vi.fn(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
        })),
        auth: {
            getUser: vi.fn(),
            signInWithPassword: vi.fn(),
            signOut: vi.fn(),
        },
        channel: vi.fn(() => ({
            on: vi.fn().mockReturnThis(),
            subscribe: vi.fn(),
        })),
    })),
}));

// Mock Next.js router
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({
        push: vi.fn(),
        replace: vi.fn(),
        refresh: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
    })),
    useParams: vi.fn(() => ({})),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    redirect: vi.fn(),
    notFound: vi.fn(),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
    cookies: vi.fn(() => ({
        get: vi.fn(),
        getAll: vi.fn(() => []),
        set: vi.fn(),
    })),
}));

// Mock the repository client
vi.mock('@/lib/db/repository-base', () => ({
    getRepositoryClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    in: vi.fn().mockResolvedValue({ data: [], error: null }),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockReturnThis(),
                    range: vi.fn().mockResolvedValue({ data: [], error: null }),
                })),
            })),
            insert: vi.fn(() => ({
                select: vi.fn(() => ({
                    single: vi.fn().mockResolvedValue({ data: {}, error: null }),
                })),
            })),
            update: vi.fn(() => ({
                eq: vi.fn(() => ({
                    select: vi.fn(() => ({
                        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
                    })),
                })),
            })),
        })),
    })),
    resetRepositoryClient: vi.fn(),
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 200,
    normalizePagination: vi.fn((params?: { limit?: number; offset?: number }) => ({
        limit: Math.min(params?.limit ?? 50, 200),
        offset: params?.offset ?? 0,
    })),
}));