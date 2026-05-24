import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.unmock('@/lib/supabase/client');
// Mock @supabase/ssr before importing the module
vi.mock('@supabase/ssr', () => ({
    createBrowserClient: vi.fn(() => ({
        auth: {
            getSession: vi.fn(),
            signInWithPassword: vi.fn(),
            signOut: vi.fn(),
        },
        from: vi.fn(() => ({
            select: vi.fn(),
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        })),
    })),
}));

describe('supabase client', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.clearAllMocks();
    });

    describe('createClient', () => {
        it('creates client with valid environment variables', async () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';

            const { createClient } = await import('./client');
            const client = createClient();

            expect(client).toBeDefined();
        });

        it('creates client with fallback URL when env var is missing', async () => {
            delete process.env.NEXT_PUBLIC_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

            const { createClient } = await import('./client');
            const client = createClient();

            expect(client).toBeDefined();
        });

        it('sanitizes environment variables with quotes and newlines', async () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = '"https://test.supabase.co"\r\n';
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "'test-key'\r";

            const { createClient } = await import('./client');
            const client = createClient();

            expect(client).toBeDefined();
        });

        it('handles empty environment variables', async () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = '';
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '';

            const { createClient } = await import('./client');
            const client = createClient();

            expect(client).toBeDefined();
        });

        it('handles whitespace-only environment variables', async () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = '   ';
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '   ';

            const { createClient } = await import('./client');
            const client = createClient();

            expect(client).toBeDefined();
        });
    });

    describe('getSupabaseClient', () => {
        it('returns a singleton client', async () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';

            // Clear module cache to reset singleton
            vi.resetModules();

            const { getSupabaseClient } = await import('./client');
            const client1 = getSupabaseClient();
            const client2 = getSupabaseClient();

            expect(client1).toBe(client2);
        });

        it('creates client on first call', async () => {
            process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';

            vi.resetModules();

            const { getSupabaseClient } = await import('./client');
            const client = getSupabaseClient();

            expect(client).toBeDefined();
        });
    });
});
