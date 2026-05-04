import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Set required environment variables for tests
process.env.QR_HMAC_SECRET = 'test_secret_key_for_testing_purposes_only_32b';
process.env.HMAC_SECRET = 'test_hmac_secret_for_testing_purposes_only_32b';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-anon-key-for-testing';
process.env.REDIS_URL = '';

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
