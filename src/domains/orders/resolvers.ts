// Orders Domain - Resolvers Layer
// Thin layer — maps GraphQL fields to service calls
import { GraphQLError } from 'graphql';
import {
    ordersService,
    CreateOrderInput as ServiceCreateOrderInput,
    UpdateOrderStatusInput as ServiceUpdateOrderStatusInput,
} from './service';
import { ordersRepository } from './repository';
import { GraphQLContext } from '@/lib/graphql/context';
import { requireAuth, requireRestaurantAccess, verifyTenantIsolation } from '@/lib/graphql/authz';
import { createErrorResult, handleResolverError, NOT_FOUND_ERROR } from '@/lib/graphql/errors';
import {
    validateInput,
    CreateOrderInputSchema,
    UpdateOrderStatusInputSchema,
    CancelOrderInputSchema,
} from '@/lib/validators/graphql';
import { JSONScalar } from '@/lib/graphql/scalars';
import { enforcePaginationLimit } from '@/lib/graphql/constants';
import { logger } from '@/lib/logger';

const mapOrderStatus = (
    status: string
): 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled' => {
    const statusMap: Record<
        string,
        'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled'
    > = {
        PENDING: 'pending',
        CONFIRMED: 'confirmed',
        PREPARING: 'preparing',
        READY: 'ready',
        SERVED: 'served',
        CANCELLED: 'cancelled',
    };
    return statusMap[status] || 'pending';
};

const _mapOrderType = (type: string): 'dine_in' | 'takeaway' | 'delivery' => {
    const typeMap: Record<string, 'dine_in' | 'takeaway' | 'delivery'> = {
        DINE_IN: 'dine_in',
        TAKEAWAY: 'takeaway',
        DELIVERY: 'delivery',
    };
    return typeMap[type] || 'dine_in';
};

/**
 * Maps an order from the service to the GraphQL response format
 */
const mapOrderToResponse = (order: {
    id: string;
    restaurant_id: string;
    table_number?: string | null;
    order_number?: string | null;
    status?: string | null;
    order_type?: string | null;
    total_price?: number | null;
    discount_amount?: number | null;
    notes?: string | null;
    guest_fingerprint?: string | null;
    idempotency_key?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
}) => ({
    id: order.id,
    restaurantId: order.restaurant_id,
    tableId: order.table_number,
    orderNumber: order.order_number,
    status: (order.status ?? 'pending').toUpperCase(),
    type: (order.order_type ?? 'dine_in').toUpperCase(),
    totalPrice: order.total_price,
    discountAmount: order.discount_amount,
    notes: order.notes,
    guestId: order.guest_fingerprint,
    idempotencyKey: order.idempotency_key,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
});

export const ordersResolvers = {
    JSON: JSONScalar,
    Query: {
        orders: async (
            _: unknown,
            args: {
                restaurantId: string;
                status?: string;
                tableId?: string;
                first?: number;
                after?: string;
            },
            context: GraphQLContext
        ) => {
            // Authorization: Verify user has access to this restaurant
            const _authContext = await requireRestaurantAccess(context, args.restaurantId);

            // Enforce pagination limits to prevent unbounded result sets
            const limit = enforcePaginationLimit(args.first);

            const orders = await ordersService.getOrders(args.restaurantId, {
                status: args.status ? mapOrderStatus(args.status) : undefined,
                tableId: args.tableId,
                limit,
                offset: args.after ? parseInt(args.after, 10) : 0,
            });

            return {
                edges: orders.map(order => ({
                    cursor: Buffer.from(order.id).toString('base64'),
                    node: order,
                })),
                pageInfo: {
                    hasNextPage: orders.length === limit,
                    hasPreviousPage: !!args.after,
                    startCursor: orders[0] ? Buffer.from(orders[0].id).toString('base64') : null,
                    endCursor: orders[orders.length - 1]
                        ? Buffer.from(orders[orders.length - 1].id).toString('base64')
                        : null,
                },
            };
        },

        order: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
            const authContext = requireAuth(context);
            const order = await ordersService.getOrder(args.id);

            // Verify tenant isolation - user can only access orders from their restaurant
            if (order && order.restaurant_id !== authContext.user.restaurantId) {
                throw new GraphQLError('Access denied to this order', {
                    extensions: { code: 'FORBIDDEN', http: { status: 403 } },
                });
            }

            return order;
        },

        activeOrders: async (
            _: unknown,
            args: { restaurantId: string },
            context: GraphQLContext
        ) => {
            // Authorization: Verify user has access to this restaurant
            await requireRestaurantAccess(context, args.restaurantId);
            return ordersService.getActiveOrders(args.restaurantId);
        },

        kdsOrders: async (
            _: unknown,
            args: { restaurantId: string; station: string },
            context: GraphQLContext
        ) => {
            // Authorization: Verify user has access to this restaurant
            await requireRestaurantAccess(context, args.restaurantId);
            return ordersService.getKDSOrders(args.restaurantId, args.station);
        },
    },

    Mutation: {
        createOrder: async (_: unknown, args: { input: unknown }, context: GraphQLContext) => {
            try {
                // Validate input
                const validation = validateInput(CreateOrderInputSchema, args.input);
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        order: null,
                    };
                }

                // Verify user has access to the restaurant
                const authContext = await requireRestaurantAccess(
                    context,
                    validation.data.restaurantId
                );

                const order = await ordersService.createOrder({
                    ...validation.data,
                    type: _mapOrderType(validation.data.type),
                    staffId: authContext.user.id, // Use authenticated user's ID
                } as unknown as ServiceCreateOrderInput);

                return {
                    success: true,
                    order: mapOrderToResponse(order),
                    error: null,
                };
            } catch (error) {
                // Re-throw GraphQL errors (like authorization errors)
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    order: null,
                };
            }
        },

        updateOrderStatus: async (
            _: unknown,
            args: { input: unknown },
            context: GraphQLContext
        ) => {
            try {
                // Validate input
                const validation = validateInput(UpdateOrderStatusInputSchema, args.input);
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        order: null,
                    };
                }

                const authContext = requireAuth(context);

                // First fetch the order to verify tenant isolation
                const existingOrder = await ordersService.getOrder(validation.data.id);
                if (!existingOrder) {
                    return {
                        ...NOT_FOUND_ERROR,
                        order: null,
                    };
                }

                // Verify tenant isolation
                verifyTenantIsolation(authContext, existingOrder.restaurant_id);

                const order = await ordersService.updateOrderStatus({
                    id: validation.data.id,
                    status: mapOrderStatus(validation.data.status),
                    staffId: authContext.user.id, // Use authenticated user's ID
                } as ServiceUpdateOrderStatusInput);

                return {
                    success: true,
                    order: mapOrderToResponse(order),
                    error: null,
                };
            } catch (error) {
                // Re-throw GraphQL errors (like authorization errors)
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    order: null,
                };
            }
        },

        cancelOrder: async (
            _: unknown,
            args: { id: string; reason?: string },
            context: GraphQLContext
        ) => {
            try {
                // Validate input
                const validation = validateInput(CancelOrderInputSchema, args);
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        order: null,
                    };
                }

                const authContext = requireAuth(context);

                // First fetch the order to verify tenant isolation
                const existingOrder = await ordersService.getOrder(validation.data.id);
                if (!existingOrder) {
                    return {
                        ...NOT_FOUND_ERROR,
                        order: null,
                    };
                }

                // Verify tenant isolation
                verifyTenantIsolation(authContext, existingOrder.restaurant_id);

                const order = await ordersService.cancelOrder({
                    id: validation.data.id,
                    reason: validation.data.reason,
                    staffId: authContext.user.id, // Use authenticated user's ID
                });

                return {
                    success: true,
                    order: mapOrderToResponse(order),
                    error: null,
                };
            } catch (error) {
                // Re-throw GraphQL errors (like authorization errors)
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    order: null,
                };
            }
        },

        createGuestOrder: async (_: unknown, args: { input: unknown }, context: GraphQLContext) => {
            try {
                // Validate input using CreateOrderInputSchema (guest orders have same base structure)
                const validation = validateInput(CreateOrderInputSchema, args.input);
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        order: null,
                    };
                }

                // Guest orders require restaurant access validation
                // The guest session should be validated separately
                const authContext = await requireRestaurantAccess(
                    context,
                    validation.data.restaurantId
                );

                // Extract guest-specific fields from the input
                const guestInput = args.input as { guestId?: string; guestSessionId?: string };

                const order = await ordersService.createOrder({
                    ...validation.data,
                    type: _mapOrderType(validation.data.type),
                    guestId: guestInput.guestId || guestInput.guestSessionId,
                    staffId: authContext.user.id, // Use authenticated user's ID
                } as unknown as ServiceCreateOrderInput);

                return {
                    success: true,
                    order: mapOrderToResponse(order),
                    error: null,
                };
            } catch (error) {
                // Re-throw GraphQL errors (like authorization errors)
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    order: null,
                };
            }
        },
    },

    Order: {
        __resolveReference: async (reference: { id: string }, context: GraphQLContext) => {
            const order = await ordersService.getOrder(reference.id);

// Validate tenant isolation
                         if (order && context.user?.restaurantId) {
                             if (order.restaurant_id !== context.user.restaurantId) {
                                 logger.error(
                                     `Tenant isolation violation: User ${context.user.id} attempted to access order ${reference.id}`,
                                     undefined,
                                     { source: 'orders/resolvers' }
                                 );
                                 return null;
                             }
                         }

            return order;
        },
        items: async (order: { id: string }, _args: unknown, context: GraphQLContext) => {
            return context.dataLoaders.orderItems.load(order.id);
        },
    },

    OrderItem: {
        __resolveReference: async (reference: { id: string }, context: GraphQLContext) => {
            const orderItem = await ordersRepository.getItemById(reference.id);

// Validate tenant isolation via parent order
                         if (orderItem && context.user?.restaurantId) {
                             if (orderItem.restaurant_id !== context.user.restaurantId) {
                                 logger.error(
                                     `Tenant isolation violation: User ${context.user.id} attempted to access order item ${reference.id}`,
                                     undefined,
                                     { source: 'orders/resolvers' }
                                 );
                                 return null;
                             }
                         }

            return orderItem;
        },
    },
};
