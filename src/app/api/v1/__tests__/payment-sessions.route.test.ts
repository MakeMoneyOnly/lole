import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as postPaymentSession } from '@/app/api/v1/merchant/operations/payments/sessions/route';
import {
    createPaymentSession,
    initiateHostedPaymentSession,
} from '@/lib/payments/payment-sessions';

const createClientMock = vi.fn();
const createServiceRoleClientMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
    createClient: () => createClientMock(),
}));

vi.mock('@/lib/supabase/service-role', () => ({
    createServiceRoleClient: () => createServiceRoleClientMock(),
}));

vi.mock('@/lib/services/orderService', () => ({
    checkDuplicateOrder: vi.fn().mockResolvedValue(null),
    checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remainingOrders: 4 }),
    generateGuestFingerprint: vi.fn().mockReturnValue('fingerprint-1'),
    generateIdempotencyKey: vi.fn().mockReturnValue('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
    validateOrderItems: vi.fn().mockResolvedValue({
        isValid: true,
        calculatedTotal: 100,
        enrichedItems: [
            {
                id: '11111111-1111-4111-8111-111111111111',
                name: 'Shiro',
                quantity: 1,
                price: 100,
                notes: null,
                course: 'main',
            },
        ],
    }),
}));

vi.mock('@/lib/security/guestContext', () => ({
    resolveGuestContext: vi.fn().mockResolvedValue({
        valid: true,
        data: {
            restaurantId: 'rest-1',
            tableId: 'table-1',
            tableNumber: 'T1',
            slug: 'demo',
            signature: 'sig',
            expiresAt: Date.now() + 1000,
        },
    }),
}));

vi.mock('@/lib/discounts/service', () => ({
    prepareOrderDiscount: vi.fn().mockResolvedValue({
        discount: null,
        calculation: {
            subtotal: 100,
            discountAmount: 0,
            total: 100,
            applied: false,
        },
    }),
}));

vi.mock('@/lib/events/runtime', () => ({
    publishEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/api/audit', () => ({
    writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/config/env', () => ({
    getAppUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}));

vi.mock('@/lib/payments/payment-sessions', async () => {
    const actual = await vi.importActual('@/lib/payments/payment-sessions');
    return {
        ...actual,
        createPaymentSession: vi.fn(),
        initiateHostedPaymentSession: vi.fn(),
    };
});

function createSupabaseQueryClient() {
    return {
        from(table: string) {
            if (table === 'restaurants') {
                return {
                    select: () => ({
                        eq: () => ({
                            maybeSingle: vi.fn().mockResolvedValue({
                                data: {
                                    id: 'rest-1',
                                    slug: 'demo',
                                    name: 'Demo Restaurant',
                                    is_active: true,
                                },
                                error: null,
                            }),
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        },
    };
}

function createAdminClient() {
    const orderInsertSingle = vi.fn().mockResolvedValue({
        data: {
            id: 'order-1',
            order_number: 'ORD-100001',
            status: 'pending',
        },
        error: null,
    });

    const orderItemsInsert = vi.fn().mockResolvedValue({ error: null });
    const tableSessionMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const tableSessionInsert = vi.fn().mockResolvedValue({ error: null });
    const orderUpdateEq = vi.fn().mockResolvedValue({ error: null });

    return {
        from(table: string) {
            if (table === 'orders') {
                return {
                    insert: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: orderInsertSingle,
                        }),
                    }),
                    update: vi.fn().mockReturnValue({
                        eq: orderUpdateEq,
                    }),
                };
            }

            if (table === 'order_items') {
                return {
                    insert: orderItemsInsert,
                    delete: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ error: null }),
                    }),
                };
            }

            if (table === 'table_sessions') {
                return {
                    select: () => ({
                        eq: vi.fn().mockReturnValue({
                            eq: vi.fn().mockReturnValue({
                                eq: vi.fn().mockReturnValue({
                                    maybeSingle: tableSessionMaybeSingle,
                                }),
                            }),
                        }),
                    }),
                    insert: tableSessionInsert,
                };
            }

            if (table === 'payment_sessions') {
                return {
                    delete: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({ error: null }),
                    }),
                };
            }

            if (table === 'campaign_deliveries' || table === 'campaigns') {
                return {
                    select: () => ({
                        eq: vi.fn().mockReturnValue({
                            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                        }),
                    }),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        },
        __orderInsertSingle: orderInsertSingle,
        __orderUpdateEq: orderUpdateEq,
        __orderItemsInsert: orderItemsInsert,
        __tableSessionInsert: tableSessionInsert,
    };
}

describe('POST /api/v1/merchant/operations/payments/sessions', () => {
    let adminClient: ReturnType<typeof createAdminClient>;

    beforeEach(() => {
        vi.clearAllMocks();
        createClientMock.mockReturnValue(createSupabaseQueryClient());
        adminClient = createAdminClient();
        createServiceRoleClientMock.mockReturnValue(adminClient);
        vi.mocked(createPaymentSession).mockResolvedValue({
            id: 'session-1',
            restaurant_id: 'rest-1',
            order_id: 'order-1',
            surface: 'guest_qr',
            channel: 'dine_in',
            intent_type: 'pay_later',
            status: 'created',
            selected_method: 'cash',
            selected_provider: null,
            amount: 100,
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
        } as any);
    });

    it('creates a deferred dine-in payment session for pay later', async () => {
        const response = await postPaymentSession(
            new NextRequest('http://localhost/api/v1/merchant/operations/payments/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guest_context: {
                        slug: 'demo',
                        table: 'T1',
                        sig: 'a'.repeat(64),
                        exp: Date.now() + 1000,
                    },
                    items: [
                        {
                            id: '11111111-1111-4111-8111-111111111111',
                            name: 'Shiro',
                            quantity: 1,
                            price: 100,
                        },
                    ],
                    total_price: 100,
                    order_type: 'dine_in',
                    payment_choice: 'pay_later',
                }),
            }) as any
        );

        const payload = await response.json();

        expect(response.status).toBe(201);
        expect(payload.data.mode).toBe('deferred');
        expect(payload.data.payment_choice).toBe('pay_later');
        expect(initiateHostedPaymentSession).not.toHaveBeenCalled();
        // createPaymentSession is mocked, so internal order creation is bypassed
        // The mock returns a session with order_id: 'order-1'
        expect(createPaymentSession).toHaveBeenCalledOnce();
    });

    it('creates a hosted checkout session for pay now', async () => {
        vi.mocked(createPaymentSession).mockResolvedValueOnce({
            id: 'session-2',
            restaurant_id: 'rest-1',
            order_id: 'order-1',
            surface: 'guest_qr',
            channel: 'dine_in',
            intent_type: 'pay_now',
            status: 'awaiting_method',
            selected_method: 'chapa',
            selected_provider: null,
            amount: 100,
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
        } as any);
        vi.mocked(initiateHostedPaymentSession).mockResolvedValueOnce({
            paymentSession: {
                id: 'session-2',
                restaurant_id: 'rest-1',
                order_id: 'order-1',
                surface: 'guest_qr',
                channel: 'dine_in',
                intent_type: 'pay_now',
                status: 'pending_provider',
                selected_method: 'chapa',
                selected_provider: 'chapa',
                amount: 100,
                currency: 'ETB',
                checkout_url: 'https://checkout.example/pay',
                provider_transaction_id: 'chapa-123',
                provider_reference: null,
                metadata: {},
                authorized_at: null,
                captured_at: null,
                expires_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            } as any,
            paymentId: 'payment-1',
            checkoutUrl: 'https://checkout.example/pay',
            provider: 'chapa',
            transactionReference: 'chapa-123',
            attempts: [{ provider: 'chapa', ok: true }],
            fallbackApplied: false,
        });

        const response = await postPaymentSession(
            new NextRequest('http://localhost/api/v1/merchant/operations/payments/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guest_context: {
                        slug: 'demo',
                        table: 'T1',
                        sig: 'a'.repeat(64),
                        exp: Date.now() + 1000,
                    },
                    items: [
                        {
                            id: '11111111-1111-4111-8111-111111111111',
                            name: 'Shiro',
                            quantity: 1,
                            price: 100,
                        },
                    ],
                    total_price: 100,
                    order_type: 'dine_in',
                    payment_choice: 'pay_now',
                }),
            }) as any
        );

        const payload = await response.json();

        expect(response.status).toBe(201);
        expect(payload.data.mode).toBe('hosted_checkout');
        expect(payload.data.provider).toBe('chapa');
        expect(payload.data.checkout_url).toBe('https://checkout.example/pay');
        expect(initiateHostedPaymentSession).toHaveBeenCalledOnce();
        // The function is called with an object containing db, orderId, amount, etc.
        expect(initiateHostedPaymentSession).toHaveBeenCalledWith(
            expect.objectContaining({
                orderId: 'order-1',
                amount: 100,
                currency: 'ETB',
                returnUrl: expect.stringContaining('http://localhost/demo?'),
            })
        );
        expect(initiateHostedPaymentSession).toHaveBeenCalledWith(
            expect.objectContaining({
                returnUrl: expect.stringContaining('table=T1'),
            })
        );
    });
});
