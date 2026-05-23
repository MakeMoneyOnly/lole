// Orders Domain - Application Layer
// Hexagonal architecture: Single entry point for order operations from API routes
// Contains use cases that orchestrate domain services with proper validation and error handling

import { z } from 'zod';
import { logger } from '@/lib/logger';
import { ordersService } from '../service';
import type { OrderRow } from '../repository';
import type { OrderStatus } from '@/types/status';

// ============================================================================
// Input/Output DTOs for Use Cases
// ============================================================================

export const GetOrdersQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    status: z
        .enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled'])
        .optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
});

export type GetOrdersQuery = z.infer<typeof GetOrdersQuerySchema>;

export const GetOrderByIdQuerySchema = z.object({
    orderId: z.string().uuid(),
    restaurantId: z.string().uuid(),
});

export type GetOrderByIdQuery = z.infer<typeof GetOrderByIdQuerySchema>;

export const CreateOrderCommandSchema = z.object({
    restaurantId: z.string().uuid(),
    tableNumber: z.string().min(1).max(50),
    orderType: z.enum(['dine_in', 'takeaway', 'delivery']).default('dine_in'),
    items: z
        .array(
            z.object({
                menuItemId: z.string().uuid(),
                quantity: z.number().int().positive().max(100),
                modifiers: z.record(z.string(), z.unknown()).optional(),
                notes: z.string().max(500).optional(),
            })
        )
        .min(1)
        .max(50),
    notes: z.string().max(1000).optional(),
    idempotencyKey: z.string().uuid(),
    staffId: z.string().uuid(),
    guestId: z.string().optional(),
    discountId: z.string().uuid().optional(),
});

export type CreateOrderCommand = z.infer<typeof CreateOrderCommandSchema>;

export const UpdateOrderStatusCommandSchema = z.object({
    orderId: z.string().uuid(),
    restaurantId: z.string().uuid(),
    status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled']),
    staffId: z.string().uuid(),
});

export type UpdateOrderStatusCommand = z.infer<typeof UpdateOrderStatusCommandSchema>;

export const CancelOrderCommandSchema = z.object({
    orderId: z.string().uuid(),
    restaurantId: z.string().uuid(),
    reason: z.string().max(500).optional(),
    staffId: z.string().uuid(),
});

export type CancelOrderCommand = z.infer<typeof CancelOrderCommandSchema>;

export const GetActiveOrdersQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
});

export type GetActiveOrdersQuery = z.infer<typeof GetActiveOrdersQuerySchema>;

export const GetKDSOrdersQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    station: z.string().min(1).max(100),
    limit: z.coerce.number().int().positive().max(200).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
});

export type GetKDSOrdersQuery = z.infer<typeof GetKDSOrdersQuerySchema>;

// ============================================================================
// Use Case Results
// ============================================================================

export interface UseCaseResult<T> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        code: string;
        details?: unknown;
    };
}

export interface OrderListResponse {
    orders: OrderRow[];
    total?: number;
}

// ============================================================================
// Validation Helpers
// ============================================================================

type ValidationResult<T> =
    | { success: true; data: T }
    | { success: false; error: { message: string; code: string; details?: unknown } };

function validateDto<T>(schema: z.ZodSchema<T>, input: unknown): ValidationResult<T> {
    const result = schema.safeParse(input);
    if (!result.success) {
        return {
            success: false,
            error: {
                message: 'Invalid input',
                code: 'VALIDATION_ERROR',
                details: result.error.flatten(),
            },
        };
    }
    return { success: true, data: result.data };
}

// ============================================================================
// OrdersApplicationService - Facade for all use cases
// ============================================================================

export class OrdersApplicationService {
    // Get paginated orders list
    async getOrders(query: GetOrdersQuery): Promise<UseCaseResult<OrderListResponse>> {
        const validation = validateDto(GetOrdersQuerySchema, query);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<OrderListResponse>;
        }

        const validQuery = validation.data;

        try {
            const orders = await ordersService.getOrders(validQuery.restaurantId, {
                status: validQuery.status as OrderStatus | undefined,
                limit: validQuery.limit,
                offset: validQuery.offset,
            });

            return {
                success: true,
                data: { orders },
            };
        } catch (error) {
            logger.error('getOrders failed', error, {
                source: '[orders/application]',
                restaurantId: validQuery.restaurantId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to fetch orders',
                    code: 'ORDERS_FETCH_FAILED',
                },
            };
        }
    }

    // Get single order by ID
    async getOrderById(query: GetOrderByIdQuery): Promise<UseCaseResult<OrderRow>> {
        const validation = validateDto(GetOrderByIdQuerySchema, query);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<OrderRow>;
        }

        const validQuery = validation.data;

        try {
            const order = await ordersService.getOrder(validQuery.orderId);

            if (!order) {
                return {
                    success: false,
                    error: {
                        message: 'Order not found',
                        code: 'ORDER_NOT_FOUND',
                    },
                };
            }

            return { success: true, data: order };
        } catch (error) {
            logger.error('getOrderById failed', error, {
                source: '[orders/application]',
                orderId: validQuery.orderId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to fetch order',
                    code: 'ORDER_FETCH_FAILED',
                },
            };
        }
    }

    // Create a new order
    async createOrder(command: CreateOrderCommand): Promise<UseCaseResult<OrderRow>> {
        const validation = validateDto(CreateOrderCommandSchema, command);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<OrderRow>;
        }

        const validCommand = validation.data;

        try {
            const order = await ordersService.createOrder({
                restaurantId: validCommand.restaurantId,
                tableId: validCommand.tableNumber,
                type: validCommand.orderType,
                items: validCommand.items.map(item => ({
                    menuItemId: item.menuItemId,
                    quantity: item.quantity,
                    modifiers: item.modifiers as Record<string, unknown> | undefined,
                    notes: item.notes,
                })),
                notes: validCommand.notes,
                idempotencyKey: validCommand.idempotencyKey,
                staffId: validCommand.staffId,
                guestId: validCommand.guestId,
            });

            logger.info('Order created', {
                orderId: order.id,
                restaurantId: validCommand.restaurantId,
                orderType: validCommand.orderType,
            });

            return { success: true, data: order };
        } catch (error) {
            logger.error('createOrder failed', error, {
                source: '[orders/application]',
                restaurantId: validCommand.restaurantId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to create order',
                    code: 'ORDER_CREATE_FAILED',
                },
            };
        }
    }

    // Update order status
    async updateOrderStatus(command: UpdateOrderStatusCommand): Promise<UseCaseResult<OrderRow>> {
        const validation = validateDto(UpdateOrderStatusCommandSchema, command);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<OrderRow>;
        }

        const validCommand = validation.data;

        try {
            const order = await ordersService.updateOrderStatus({
                id: validCommand.orderId,
                status: validCommand.status as OrderStatus,
                staffId: validCommand.staffId,
            });

            logger.info('Order status updated', {
                orderId: validCommand.orderId,
                restaurantId: validCommand.restaurantId,
                status: validCommand.status,
            });

            return { success: true, data: order };
        } catch (error) {
            logger.error('updateOrderStatus failed', error, {
                source: '[orders/application]',
                orderId: validCommand.orderId,
            });
            return {
                success: false,
                error: {
                    message:
                        error instanceof Error ? error.message : 'Failed to update order status',
                    code: 'ORDER_UPDATE_FAILED',
                },
            };
        }
    }

    // Cancel an order
    async cancelOrder(command: CancelOrderCommand): Promise<UseCaseResult<OrderRow>> {
        const validation = validateDto(CancelOrderCommandSchema, command);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<OrderRow>;
        }

        const validCommand = validation.data;

        try {
            const order = await ordersService.cancelOrder({
                id: validCommand.orderId,
                reason: validCommand.reason,
                staffId: validCommand.staffId,
            });

            logger.info('Order cancelled', {
                orderId: validCommand.orderId,
                restaurantId: validCommand.restaurantId,
                reason: validCommand.reason,
            });

            return { success: true, data: order };
        } catch (error) {
            logger.error('cancelOrder failed', error, {
                source: '[orders/application]',
                orderId: validCommand.orderId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to cancel order',
                    code: 'ORDER_CANCEL_FAILED',
                },
            };
        }
    }

    // Get active orders
    async getActiveOrders(query: GetActiveOrdersQuery): Promise<UseCaseResult<OrderListResponse>> {
        const validation = validateDto(GetActiveOrdersQuerySchema, query);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<OrderListResponse>;
        }

        const validQuery = validation.data;

        try {
            const orders = await ordersService.getActiveOrders(validQuery.restaurantId);

            return {
                success: true,
                data: { orders },
            };
        } catch (error) {
            logger.error('getActiveOrders failed', error, {
                source: '[orders/application]',
                restaurantId: validQuery.restaurantId,
            });
            return {
                success: false,
                error: {
                    message:
                        error instanceof Error ? error.message : 'Failed to fetch active orders',
                    code: 'ORDERS_FETCH_FAILED',
                },
            };
        }
    }

    // Get KDS orders by station
    async getKDSOrders(query: GetKDSOrdersQuery): Promise<UseCaseResult<OrderListResponse>> {
        const validation = validateDto(GetKDSOrdersQuerySchema, query);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<OrderListResponse>;
        }

        const validQuery = validation.data;

        try {
            const orders = await ordersService.getKDSOrders(
                validQuery.restaurantId,
                validQuery.station
            );

            return {
                success: true,
                data: { orders },
            };
        } catch (error) {
            logger.error('getKDSOrders failed', error, {
                source: '[orders/application]',
                restaurantId: validQuery.restaurantId,
                station: validQuery.station,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to fetch KDS orders',
                    code: 'ORDERS_FETCH_FAILED',
                },
            };
        }
    }
}

// Singleton instance for the application
export const ordersApplicationService = new OrdersApplicationService();
