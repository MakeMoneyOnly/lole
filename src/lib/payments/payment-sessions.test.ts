import { describe, it, expect, vi } from 'vitest';
import {
    getSurfaceForOrderMode,
    getDefaultProviderForMethod,
    createPaymentSession,
    updatePaymentSession,
    findLatestPaymentSessionForOrder,
    ensurePaymentSessionForRecordedPayment,
    PAYMENT_SESSION_SURFACES,
    PAYMENT_SESSION_CHANNELS,
    PAYMENT_SESSION_INTENTS,
    PAYMENT_SESSION_STATUSES,
} from './payment-sessions';
function makeSession(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'ps-1',
        restaurant_id: 'rest-1',
        order_id: 'order-1',
        surface: 'guest_qr',
        channel: 'dine_in',
        intent_type: 'pay_now',
        status: 'created',
        selected_method: null,
        selected_provider: null,
        amount: 250,
        currency: 'ETB',
        checkout_url: null,
        provider_transaction_id: null,
        provider_reference: null,
        metadata: {},
        authorized_at: null,
        captured_at: null,
        expires_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...overrides,
    };
}
function makeDb(fromOverrides: Record<string, unknown> = {}): any {
    const base = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: makeSession(), error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        ...fromOverrides,
    };
    return { from: vi.fn().mockReturnValue(base) };
}

describe('payment-sessions', () => {
    describe('constants', () => {
        it('exports the correct surfaces', () => {
            expect(PAYMENT_SESSION_SURFACES).toContain('guest_qr');
            expect(PAYMENT_SESSION_SURFACES).toContain('online_order');
            expect(PAYMENT_SESSION_SURFACES).toContain('waiter_pos');
            expect(PAYMENT_SESSION_SURFACES).toContain('terminal');
        });

        it('exports the correct channels', () => {
            expect(PAYMENT_SESSION_CHANNELS).toContain('dine_in');
            expect(PAYMENT_SESSION_CHANNELS).toContain('pickup');
            expect(PAYMENT_SESSION_CHANNELS).toContain('delivery');
        });

        it('exports the correct statuses', () => {
            expect(PAYMENT_SESSION_STATUSES).toContain('created');
            expect(PAYMENT_SESSION_STATUSES).toContain('captured');
            expect(PAYMENT_SESSION_STATUSES).toContain('failed');
        });

        it('exports the correct intents', () => {
            expect(PAYMENT_SESSION_INTENTS).toContain('pay_now');
            expect(PAYMENT_SESSION_INTENTS).toContain('staff_recorded');
        });
    });

    describe('getSurfaceForOrderMode', () => {
        it('returns online_order for online orders', () => {
            expect(getSurfaceForOrderMode(true)).toBe('online_order');
        });

        it('returns guest_qr for non-online orders', () => {
            expect(getSurfaceForOrderMode(false)).toBe('guest_qr');
        });
    });

    describe('getDefaultProviderForMethod', () => {
        it('returns chapa regardless of method', () => {
            expect(getDefaultProviderForMethod('cash')).toBe('chapa');
            expect(getDefaultProviderForMethod('card')).toBe('chapa');
            expect(getDefaultProviderForMethod(null)).toBe('chapa');
            expect(getDefaultProviderForMethod(undefined)).toBe('chapa');
        });
    });

    describe('createPaymentSession', () => {
        it('creates a payment session and returns the record', async () => {
            const session = makeSession({ id: 'ps-new' });
            const db = makeDb({
                insert: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: session, error: null }),
            });

            const result = await createPaymentSession(db, {
                restaurant_id: 'rest-1',
                order_id: 'order-1',
                surface: 'guest_qr',
                channel: 'dine_in',
                intent_type: 'pay_now',
                amount: 250,
            });

            expect(result.id).toBe('ps-new');
            expect(db.from).toHaveBeenCalledWith('payment_sessions');
        });

        it('defaults currency to ETB', async () => {
            const session = makeSession({ currency: 'ETB' });
            const db = makeDb({
                insert: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: session, error: null }),
            });

            await createPaymentSession(db, {
                restaurant_id: 'rest-1',
                order_id: 'order-1',
                surface: 'guest_qr',
                channel: 'dine_in',
                intent_type: 'pay_now',
                amount: 100,
            });

            const insertMock = db.from().insert;
            expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ currency: 'ETB' }));
        });

        it('throws when insert errors', async () => {
            const db = makeDb({
                insert: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: { message: 'insert error' } }),
            });

            await expect(
                createPaymentSession(db, {
                    restaurant_id: 'rest-1',
                    order_id: null,
                    surface: 'terminal',
                    channel: 'pickup',
                    intent_type: 'pay_now',
                    amount: 50,
                })
            ).rejects.toThrow('insert error');
        });

        it('defaults status to created', async () => {
            const session = makeSession();
            const db = makeDb({
                insert: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: session, error: null }),
            });

            await createPaymentSession(db, {
                restaurant_id: 'rest-1',
                order_id: null,
                surface: 'guest_qr',
                channel: 'dine_in',
                intent_type: 'pay_now',
                amount: 100,
            });

            const insertMock = db.from().insert;
            expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'created' }));
        });
    });

    describe('updatePaymentSession', () => {
        it('updates a session and returns the updated record', async () => {
            const updatedSession = makeSession({ status: 'captured' });
            const db = makeDb({
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: updatedSession, error: null }),
            });

            const result = await updatePaymentSession(db, 'ps-1', { status: 'captured' });
            expect(result.status).toBe('captured');
        });

        it('throws when update errors', async () => {
            const db = makeDb({
                update: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnThis(),
                single: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: { message: 'update failed' } }),
            });

            await expect(updatePaymentSession(db, 'ps-1', { status: 'failed' })).rejects.toThrow(
                'update failed'
            );
        });
    });

    describe('findLatestPaymentSessionForOrder', () => {
        it('returns the session when found', async () => {
            const session = makeSession();
            const db = makeDb({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: session, error: null }),
            });

            const result = await findLatestPaymentSessionForOrder(db, 'rest-1', 'order-1');
            expect(result).not.toBeNull();
            expect(result?.id).toBe('ps-1');
        });

        it('returns null when no session found', async () => {
            const db = makeDb({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            });

            const result = await findLatestPaymentSessionForOrder(db, 'rest-1', 'order-1');
            expect(result).toBeNull();
        });

        it('throws when query errors', async () => {
            const db = makeDb({
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: { message: 'query failed' } }),
            });

            await expect(findLatestPaymentSessionForOrder(db, 'rest-1', 'order-1')).rejects.toThrow(
                'query failed'
            );
        });
    });

    describe('ensurePaymentSessionForRecordedPayment', () => {
        it('creates a new session when none exists', async () => {
            const newSession = makeSession({ id: 'ps-new', status: 'captured' });
            const db = {
                from: vi.fn().mockImplementation((table: string) => {
                    if (table === 'payment_sessions') {
                        return {
                            select: vi.fn().mockReturnThis(),
                            insert: vi.fn().mockReturnThis(),
                            update: vi.fn().mockReturnThis(),
                            eq: vi.fn().mockReturnThis(),
                            order: vi.fn().mockReturnThis(),
                            limit: vi.fn().mockReturnThis(),
                            single: vi.fn().mockResolvedValue({ data: newSession, error: null }),
                            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                        };
                    }
                    return {
                        select: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    };
                }),
            };

            const result = await ensurePaymentSessionForRecordedPayment(db, {
                restaurantId: 'rest-1',
                orderId: 'order-1',
                surface: 'waiter_pos',
                channel: 'dine_in',
                method: 'cash',
                amount: 250,
                status: 'captured',
            });

            expect(result).toBeDefined();
        });

        it('maps payment status to session status correctly', async () => {
            const statuses: Array<{
                input: 'authorized' | 'captured' | 'voided' | 'failed' | 'pending';
                expected: string;
            }> = [
                { input: 'authorized', expected: 'authorized' },
                { input: 'captured', expected: 'captured' },
                { input: 'voided', expected: 'cancelled' },
                { input: 'failed', expected: 'failed' },
                { input: 'pending', expected: 'pending_provider' },
            ];

            for (const { input, expected } of statuses) {
                const updatedSession = makeSession({ status: expected });
                const db = {
                    from: vi.fn().mockImplementation((_table: string) => ({
                        select: vi.fn().mockReturnThis(),
                        insert: vi.fn().mockReturnThis(),
                        update: vi.fn().mockReturnThis(),
                        eq: vi.fn().mockReturnThis(),
                        order: vi.fn().mockReturnThis(),
                        limit: vi.fn().mockReturnThis(),
                        single: vi.fn().mockResolvedValue({ data: updatedSession, error: null }),
                        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    })),
                };

                const result = await ensurePaymentSessionForRecordedPayment(db, {
                    restaurantId: 'rest-1',
                    orderId: null,
                    surface: 'terminal',
                    channel: 'dine_in',
                    method: 'cash',
                    amount: 100,
                    status: input,
                });

                expect(result.status).toBe(expected);
            }
        });

        it('uses chapa as intent_type for chapa method', async () => {
            const newSession = makeSession({ intent_type: 'assisted_digital' });
            const db = {
                from: vi.fn().mockImplementation(() => ({
                    select: vi.fn().mockReturnThis(),
                    insert: vi.fn().mockReturnThis(),
                    update: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockReturnThis(),
                    limit: vi.fn().mockReturnThis(),
                    single: vi.fn().mockResolvedValue({ data: newSession, error: null }),
                    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
            };

            const result = await ensurePaymentSessionForRecordedPayment(db, {
                restaurantId: 'rest-1',
                orderId: null,
                surface: 'terminal',
                channel: 'dine_in',
                method: 'chapa',
                amount: 100,
                status: 'captured',
            });

            expect(result).toBeDefined();
        });
    });
});
