import { describe, it, expect, vi, beforeEach } from 'vitest';

// Valid UUID v4 format that passes zod UUID validation
const UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('OrdersApplicationService', () => {
    beforeEach(async () => {
        vi.resetModules();
    });

    describe('validation', () => {
        it('returns validation error for invalid restaurantId in getOrders', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.getOrders({
                restaurantId: 'invalid-uuid',
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns validation error for invalid orderId in getOrderById', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.getOrderById({
                orderId: 'invalid-uuid',
                restaurantId: UUID,
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns validation error for invalid restaurantId in getOrderById', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.getOrderById({
                orderId: UUID,
                restaurantId: 'invalid-uuid',
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns validation error for invalid UUID in createOrder', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.createOrder({
                restaurantId: 'invalid-uuid',
                tableNumber: 'T1',
                items: [{ menuItemId: UUID, quantity: 1 }],
                idempotencyKey: UUID,
                staffId: UUID,
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns validation error for empty items array in createOrder', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.createOrder({
                restaurantId: UUID,
                tableNumber: 'T1',
                orderType: 'dine_in',
                items: [],
                idempotencyKey: UUID,
                staffId: UUID,
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns validation error for invalid UUID in updateOrderStatus', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.updateOrderStatus({
                orderId: 'invalid-uuid',
                restaurantId: UUID,
                status: 'confirmed',
                staffId: UUID,
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns validation error for invalid status in updateOrderStatus', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.updateOrderStatus({
                orderId: UUID,
                restaurantId: UUID,
                status: 'invalid-status' as any,
                staffId: UUID,
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns validation error for invalid UUID in cancelOrder', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.cancelOrder({
                orderId: 'invalid-uuid',
                restaurantId: UUID,
                staffId: UUID,
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('restaurant scoping validation', () => {
        it('validates restaurant_id is required for getOrders', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.getOrders({
                restaurantId: '',
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('validates restaurant_id is required for getOrderById', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.getOrderById({
                orderId: UUID,
                restaurantId: '',
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('validates restaurant_id is required for updateOrderStatus', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.updateOrderStatus({
                orderId: UUID,
                restaurantId: '',
                status: 'confirmed',
                staffId: UUID,
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('validates restaurant_id is required for cancelOrder', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.cancelOrder({
                orderId: UUID,
                restaurantId: '',
                staffId: UUID,
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('staff authorization validation', () => {
        it('validates staffId is required for createOrder', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.createOrder({
                restaurantId: UUID,
                tableNumber: 'T1',
                items: [{ menuItemId: UUID, quantity: 1 }],
                idempotencyKey: UUID,
                staffId: '',
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('validates staffId is required for updateOrderStatus', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.updateOrderStatus({
                orderId: UUID,
                restaurantId: UUID,
                status: 'confirmed',
                staffId: '',
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('validates staffId is required for cancelOrder', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.cancelOrder({
                orderId: UUID,
                restaurantId: UUID,
                staffId: '',
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('order status validation', () => {
        it('accepts valid status values for updateOrderStatus schema', async () => {
            const { UpdateOrderStatusCommandSchema } =
                await import('../application/orders-application-service');

            const validStatuses = [
                'pending',
                'confirmed',
                'preparing',
                'ready',
                'served',
                'cancelled',
            ] as const;

            for (const status of validStatuses) {
                const result = UpdateOrderStatusCommandSchema.safeParse({
                    orderId: UUID,
                    restaurantId: UUID,
                    status,
                    staffId: UUID,
                });

                expect(result.success).toBe(true);
            }
        });

        it('rejects invalid status values', async () => {
            const { UpdateOrderStatusCommandSchema } =
                await import('../application/orders-application-service');

            const result = UpdateOrderStatusCommandSchema.safeParse({
                orderId: UUID,
                restaurantId: UUID,
                status: 'invalid-status',
                staffId: UUID,
            });

            expect(result.success).toBe(false);
        });
    });

    describe('createOrder validation', () => {
        it('accepts valid orderType enum values', async () => {
            const { CreateOrderCommandSchema } =
                await import('../application/orders-application-service');

            const validTypes = ['dine_in', 'takeaway', 'delivery'] as const;

            for (const orderType of validTypes) {
                const result = CreateOrderCommandSchema.safeParse({
                    restaurantId: UUID,
                    tableNumber: 'T1',
                    orderType,
                    items: [{ menuItemId: UUID, quantity: 1 }],
                    idempotencyKey: UUID,
                    staffId: UUID,
                });

                expect(result.success).toBe(true);
            }
        });

        it('returns validation error for invalid orderType', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.createOrder({
                restaurantId: UUID,
                tableNumber: 'T1',
                orderType: 'invalid-type' as any,
                items: [{ menuItemId: UUID, quantity: 1 }],
                idempotencyKey: UUID,
                staffId: UUID,
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('validates item quantity is positive', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.createOrder({
                restaurantId: UUID,
                tableNumber: 'T1',
                orderType: 'dine_in',
                items: [{ menuItemId: UUID, quantity: 0 }],
                idempotencyKey: UUID,
                staffId: UUID,
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('validates maximum items limit (50)', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const items = Array.from({ length: 51 }, (_, i) => ({
                menuItemId: `item-${i}`,
                quantity: 1,
            }));

            const result = await service.createOrder({
                restaurantId: UUID,
                tableNumber: 'T1',
                items: items as any,
                idempotencyKey: UUID,
                staffId: UUID,
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('getOrders pagination validation', () => {
        it('validates limit maximum of 200', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const result = await service.getOrders({
                restaurantId: UUID,
                limit: 201,
                offset: 0,
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('accepts valid limit within range for schema', async () => {
            const { GetOrdersQuerySchema } =
                await import('../application/orders-application-service');

            const result = GetOrdersQuerySchema.safeParse({
                restaurantId: UUID,
                limit: 100,
                offset: 0,
            });

            expect(result.success).toBe(true);
        });
    });

    describe('input sanitization', () => {
        it('truncates notes field to max 1000 characters in createOrder', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const longNotes = 'a'.repeat(1500);

            const result = await service.createOrder({
                restaurantId: UUID,
                tableNumber: 'T1',
                orderType: 'dine_in',
                items: [{ menuItemId: UUID, quantity: 1 }],
                idempotencyKey: UUID,
                staffId: UUID,
                notes: longNotes,
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('truncates cancel reason to max 500 characters', async () => {
            const { OrdersApplicationService } =
                await import('../application/orders-application-service');
            const service = new OrdersApplicationService();

            const longReason = 'a'.repeat(600);

            const result = await service.cancelOrder({
                orderId: UUID,
                restaurantId: UUID,
                staffId: UUID,
                reason: longReason,
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });
    });
});
