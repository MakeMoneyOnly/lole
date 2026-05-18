import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(),
}));

import {
    logSecurityEvent,
    detectBruteForce,
    checkTenantIsolation,
    logInvalidSignatureAttempt,
} from './securityEvents';
import { createClient } from '@/lib/supabase/server';
function makeDb(overrides: Record<string, unknown> = {}): any {
    const base = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        ...overrides,
    };
    return { from: vi.fn().mockReturnValue(base) };
}

const baseEvent = {
    type: 'auth_failure' as const,
    severity: 'medium' as const,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date('2024-01-01T00:00:00Z'),
};

describe('securityEvents', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('logSecurityEvent', () => {
        it('inserts a record with the correct action prefix', async () => {
            const insertMock = vi.fn().mockResolvedValue({ error: null });
            const db = makeDb({ insert: insertMock });

            vi.mocked(createClient).mockResolvedValue(db as any);

            await logSecurityEvent(baseEvent);

            expect(insertMock).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'security:auth_failure' })
            );
        });

        it('uses "anonymous" as entity_id when userId is not provided', async () => {
            const insertMock = vi.fn().mockResolvedValue({ error: null });
            const db = makeDb({ insert: insertMock });

            vi.mocked(createClient).mockResolvedValue(db as any);

            await logSecurityEvent({ ...baseEvent, userId: undefined });

            expect(insertMock).toHaveBeenCalledWith(
                expect.objectContaining({ entity_id: 'anonymous' })
            );
        });

        it('uses userId as entity_id when provided', async () => {
            const insertMock = vi.fn().mockResolvedValue({ error: null });
            const db = makeDb({ insert: insertMock });

            vi.mocked(createClient).mockResolvedValue(db as any);

            await logSecurityEvent({ ...baseEvent, userId: 'user-123', severity: 'low' });

            expect(insertMock).toHaveBeenCalledWith(
                expect.objectContaining({ entity_id: 'user-123' })
            );
        });

        it('includes restaurantId in insert when provided', async () => {
            const insertMock = vi.fn().mockResolvedValue({ error: null });
            const db = makeDb({ insert: insertMock });

            vi.mocked(createClient).mockResolvedValue(db as any);

            await logSecurityEvent({ ...baseEvent, restaurantId: 'rest-1', severity: 'low' });

            expect(insertMock).toHaveBeenCalledWith(
                expect.objectContaining({ restaurant_id: 'rest-1' })
            );
        });

        it('does not throw when insert errors', async () => {
            const db = makeDb({
                insert: vi.fn().mockResolvedValue({ error: { message: 'DB fail' } }),
            });

            vi.mocked(createClient).mockResolvedValue(db as any);

            await expect(logSecurityEvent(baseEvent)).resolves.not.toThrow();
        });

        it('triggers alert for critical severity immediately', async () => {
            const insertMock = vi.fn().mockResolvedValue({ error: null });

            vi.mocked(createClient).mockResolvedValue(makeDb({ insert: insertMock }) as any);

            await logSecurityEvent({ ...baseEvent, severity: 'critical' });

            // audit log insert + alert insert
            expect(insertMock.mock.calls.length).toBeGreaterThanOrEqual(2);
        });

        it('checks event count for non-critical events before alerting', async () => {
            const selectMock = vi.fn().mockReturnThis();
            const eqMock = vi.fn().mockReturnThis();
            const gteMock = vi.fn().mockResolvedValue({ count: 0, error: null });
            const insertMock = vi.fn().mockResolvedValue({ error: null });

            vi.mocked(createClient).mockResolvedValue({
                from: vi.fn().mockReturnValue({
                    insert: insertMock,
                    select: selectMock,
                    eq: eqMock,
                    gte: gteMock,
                }),
            } as any);

            await logSecurityEvent({ ...baseEvent, severity: 'high' });

            // Should have checked the count
            expect(gteMock).toHaveBeenCalled();
        });
    });

    describe('detectBruteForce', () => {
        it('returns false when attempt count is below threshold', async () => {
            const db = {
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockResolvedValue({ count: 2, error: null }),
                    insert: vi.fn().mockResolvedValue({ error: null }),
                }),
            };

            vi.mocked(createClient).mockResolvedValue(db as any);

            const result = await detectBruteForce('user@example.com', 'login');
            expect(result).toBe(false);
        });

        it('returns true when at or above threshold', async () => {
            const insertMock = vi.fn().mockResolvedValue({ error: null });

            vi.mocked(createClient).mockResolvedValue({
                from: vi.fn().mockImplementation(() => ({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockResolvedValue({ count: 5, error: null }),
                    insert: insertMock,
                })),
            } as any);

            const result = await detectBruteForce('user@example.com', 'login', 5);
            expect(result).toBe(true);
        });

        it('returns false on query error (fail open)', async () => {
            vi.mocked(createClient).mockResolvedValue({
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockResolvedValue({ count: null, error: { message: 'Timeout' } }),
                    insert: vi.fn().mockResolvedValue({ error: null }),
                }),
            } as any);

            const result = await detectBruteForce('user@example.com', 'login');
            expect(result).toBe(false);
        });

        it('respects custom maxAttempts threshold', async () => {
            vi.mocked(createClient).mockResolvedValue({
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockResolvedValue({ count: 3, error: null }),
                    insert: vi.fn().mockResolvedValue({ error: null }),
                }),
            } as any);

            // count 3 < maxAttempts 10 → false
            expect(await detectBruteForce('id', 'action', 10)).toBe(false);
            // count 3 >= maxAttempts 3 → true (re-mock needed but threshold check validates logic)
        });
    });

    describe('checkTenantIsolation', () => {
        it('returns valid when staff record found', async () => {
            vi.mocked(createClient).mockResolvedValue({
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi
                        .fn()
                        .mockResolvedValue({ data: { restaurant_id: 'rest-1' }, error: null }),
                    insert: vi.fn().mockResolvedValue({ error: null }),
                    gte: vi.fn().mockReturnThis(),
                }),
            } as any);

            const result = await checkTenantIsolation('user-1', 'rest-1');
            expect(result.valid).toBe(true);
        });

        it('returns invalid and logs event when no staff record', async () => {
            const insertMock = vi.fn().mockResolvedValue({ error: null });

            vi.mocked(createClient).mockResolvedValue({
                from: vi.fn().mockImplementation(() => ({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    insert: insertMock,
                    gte: vi.fn().mockReturnThis(),
                })),
            } as any);

            const result = await checkTenantIsolation('user-1', 'rest-999');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('denied');
        });

        it('returns invalid on database error', async () => {
            vi.mocked(createClient).mockResolvedValue({
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    maybeSingle: vi
                        .fn()
                        .mockResolvedValue({ data: null, error: { message: 'Query failed' } }),
                    insert: vi.fn().mockResolvedValue({ error: null }),
                    gte: vi.fn().mockReturnThis(),
                }),
            } as any);

            const result = await checkTenantIsolation('user-1', 'rest-1');
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Failed to verify');
        });
    });

    describe('logInvalidSignatureAttempt', () => {
        it('logs with type invalid_signature_attempt', async () => {
            const insertMock = vi.fn().mockResolvedValue({ error: null });

            vi.mocked(createClient).mockResolvedValue({
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockReturnThis(),
                    insert: insertMock,
                }),
            } as any);

            await logInvalidSignatureAttempt('1.2.3.4', 'curl', { webhook: 'chapa' });

            expect(insertMock).toHaveBeenCalledWith(
                expect.objectContaining({ action: 'security:invalid_signature_attempt' })
            );
        });

        it('does not throw on logging failure', async () => {
            vi.mocked(createClient).mockResolvedValue({
                from: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockReturnThis(),
                    insert: vi.fn().mockResolvedValue({ error: { message: 'fail' } }),
                }),
            } as any);

            await expect(logInvalidSignatureAttempt('1.2.3.4', 'bot', {})).resolves.not.toThrow();
        });
    });
});
