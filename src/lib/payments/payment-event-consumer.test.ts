import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaymentLifecycleEvent } from '@/lib/events/contracts';
import { processPaymentLifecycleEvent } from '@/lib/payments/payment-event-consumer';
import { writeAuditLog } from '@/lib/api/audit';

const createServiceRoleClient = vi.fn();

vi.mock('@/lib/supabase/service-role', () => ({
    createServiceRoleClient: () => createServiceRoleClient(),
}));

vi.mock('@/lib/api/audit', () => ({
    writeAuditLog: vi.fn(),
}));

const writeAuditLogMock = vi.mocked(writeAuditLog);

function createPaymentEvent(overrides?: Partial<PaymentLifecycleEvent>): PaymentLifecycleEvent {
    return {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        version: 1,
        name: 'payment.completed',
        occurred_at: '2026-03-07T10:00:00.000Z',
        trace_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        payload: {
            restaurant_id: '55555555-5555-4555-8555-555555555555',
            order_id: '66666666-6666-4666-8666-666666666666',
            payment_id: null,
            provider: 'chapa',
            provider_transaction_id: 'tx-1',
            idempotency_key: 'idempotency-key',
            status: 'completed',
            amount: 125,
            currency: 'ETB',
            metadata: {},
            raw_payload: {},
        },
        ...overrides,
    };
}
function createSupabaseMock(
    params: {
        order?: {
            id: string;
            restaurant_id: string;
            total_price?: number;
            status?: string;
            order_number?: string;
            paid_at?: null;
        };
        payment?: { id: string; status: string; order_id: string; restaurant_id: string } | null;
        paymentSession?: {
            id: string;
            order_id: string;
            restaurant_id: string;
            status: string;
            metadata: Record<string, unknown>;
        };
        insertedPaymentId?: string;
    } = {}
): any {
    const paymentsUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const ordersUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const paymentSessionsUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const paymentsInsertSingle = vi.fn().mockResolvedValue({
        data: params.insertedPaymentId ? { id: params.insertedPaymentId } : null,
        error: null,
    });

    return {
        from(table: string) {
            if (table === 'orders') {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: vi.fn().mockResolvedValue({ data: params.order ?? null }),
                        }),
                    }),
                    update: vi.fn().mockReturnValue({
                        eq: ordersUpdateEq,
                    }),
                };
            }

            if (table === 'payment_sessions') {
                return {
                    select: () => {
                        const chain = {
                            eq: vi.fn(),
                            order: vi.fn(),
                            limit: vi.fn(),
                            maybeSingle: vi
                                .fn()
                                .mockResolvedValue({ data: params.paymentSession ?? null }),
                        };
                        chain.eq.mockReturnValue(chain);
                        chain.order.mockReturnValue(chain);
                        chain.limit.mockReturnValue(chain);
                        return chain;
                    },
                    update: vi.fn().mockReturnValue({
                        eq: paymentSessionsUpdateEq,
                    }),
                };
            }

            if (table === 'payments') {
                return {
                    select: () => {
                        const chain = {
                            eq: vi.fn(),
                            order: vi.fn(),
                            limit: vi.fn(),
                            maybeSingle: vi
                                .fn()
                                .mockResolvedValue({ data: params.payment ?? null }),
                        };
                        chain.eq.mockReturnValue(chain);
                        chain.order.mockReturnValue(chain);
                        chain.limit.mockReturnValue(chain);
                        return chain;
                    },
                    update: vi.fn().mockReturnValue({
                        eq: paymentsUpdateEq,
                    }),
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: paymentsInsertSingle,
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        },
        __paymentsUpdateEq: paymentsUpdateEq,
        __ordersUpdateEq: ordersUpdateEq,
        __paymentSessionsUpdateEq: paymentSessionsUpdateEq,
        __paymentsInsertSingle: paymentsInsertSingle,
    };
}

describe('processPaymentLifecycleEvent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        writeAuditLogMock.mockResolvedValue({ error: null } as any);
    });

    it('returns already_processed for duplicate captured callbacks', async () => {
        const supabase = createSupabaseMock({
            order: {
                id: '66666666-6666-4666-8666-666666666666',
                restaurant_id: '55555555-5555-4555-8555-555555555555',
                total_price: 125,
            },
            payment: {
                id: '77777777-7777-4777-8777-777777777777',
                status: 'captured',
                order_id: '66666666-6666-4666-8666-666666666666',
                restaurant_id: '55555555-5555-4555-8555-555555555555',
            },
            paymentSession: {
                id: '99999999-9999-4999-8999-999999999999',
                order_id: '66666666-6666-4666-8666-666666666666',
                restaurant_id: '55555555-5555-4555-8555-555555555555',
                status: 'captured',
                metadata: {},
            },
        });
        createServiceRoleClient.mockReturnValue(supabase);

        const result = await processPaymentLifecycleEvent(createPaymentEvent());

        expect(result.outcome).toBe('already_processed');
        expect(writeAuditLogMock).not.toHaveBeenCalled();
    });

    it('creates a payment record and updates the order for first successful callbacks', async () => {
        const supabase = createSupabaseMock({
            order: {
                id: '66666666-6666-4666-8666-666666666666',
                restaurant_id: '55555555-5555-4555-8555-555555555555',
                status: 'payment_pending',
                order_number: 'ORD-100001',
                total_price: 125,
                paid_at: null,
            },
            payment: null,
            paymentSession: {
                id: '99999999-9999-4999-8999-999999999999',
                order_id: '66666666-6666-4666-8666-666666666666',
                restaurant_id: '55555555-5555-4555-8555-555555555555',
                status: 'pending_provider',
                metadata: {},
            },
            insertedPaymentId: '88888888-8888-4888-8888-888888888888',
        });
        createServiceRoleClient.mockReturnValue(supabase);

        const result = await processPaymentLifecycleEvent(createPaymentEvent());

        expect(result.outcome).toBe('processed');
        expect(supabase.__paymentsInsertSingle).toHaveBeenCalledOnce();
        expect(supabase.__ordersUpdateEq).toHaveBeenCalledOnce();
        expect(supabase.__paymentSessionsUpdateEq).toHaveBeenCalledOnce();
        expect(writeAuditLogMock).toHaveBeenCalledOnce();
    });
});
