// Payments Domain - Resolvers Layer
// GraphQL resolvers with authorization and validation
import { GraphQLError } from 'graphql';
import { GraphQLContext } from '@/lib/graphql/context';
import { requireAuth, requireRestaurantAccess } from '@/lib/graphql/authz';
import { createErrorResult, handleResolverError } from '@/lib/graphql/errors';
import { validateInput, InitiatePaymentInputSchema } from '@/lib/validators/graphql';
import { paymentsRepository } from './repository';
import { paymentsService } from './service';
import { PaymentStatus } from './repository';
import { logger } from '@/lib/logger';

export const paymentsResolvers = {
    Query: {
        payment: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
            // Authorization: Require authentication
            const authContext = requireAuth(context);

            // HIGH-021: Use DataLoader for N+1 prevention
            // DataLoader handles tenant verification internally
            const payment = await context.dataLoaders.payments.load(args.id);

            // Tenant isolation: DataLoader already verified, but double-check for safety
            if (payment && authContext.user?.restaurantId) {
                if (payment.restaurant_id !== authContext.user.restaurantId) {
                    throw new GraphQLError('Access denied to this payment', {
                        extensions: { code: 'FORBIDDEN', http: { status: 403 } },
                    });
                }
            }

            return payment;
        },

        payments: async (
            _: unknown,
            args: {
                orderId?: string;
                restaurantId?: string;
                status?: string;
                limit?: number;
                offset?: number;
            },
            context: GraphQLContext
        ) => {
            // Must provide either orderId or restaurantId
            if (!args.orderId && !args.restaurantId) {
                throw new GraphQLError('Must provide either orderId or restaurantId', {
                    extensions: { code: 'BAD_REQUEST', http: { status: 400 } },
                });
            }

            // If restaurantId provided, verify access
            if (args.restaurantId) {
                await requireRestaurantAccess(context, args.restaurantId);
            }

            // HIGH-021: Use DataLoader for orderId-based queries (N+1 prevention)
            if (args.orderId) {
                // For orderId-based queries, use DataLoader for batching
                // Note: DataLoader doesn't support status filtering, so fall back to repository for filtered queries
                if (args.status) {
                    return paymentsRepository.getPaymentsByOrder(args.orderId, {
                        status: args.status as PaymentStatus,
                        limit: args.limit ?? 50,
                        offset: args.offset ?? 0,
                    });
                }
                // Use DataLoader for unfiltered queries
                return context.dataLoaders.paymentsByOrder.load(args.orderId);
            } else {
                // restaurantId-based query
                return paymentsRepository.getPaymentsByRestaurant(args.restaurantId!, {
                    status: args.status as PaymentStatus,
                    limit: args.limit ?? 50,
                    offset: args.offset ?? 0,
                });
            }
        },
    },

    Mutation: {
        initiatePayment: async (_: unknown, args: { input: unknown }, _context: GraphQLContext) => {
            try {
                // Validate input
                const validation = validateInput(InitiatePaymentInputSchema, args.input);
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        payment: null,
                    };
                }

                // Initiate payment
                const result = await paymentsService.initiatePayment({
                    orderId: validation.data.orderId,
                    amountSantim: validation.data.amount,
                    idempotencyKey: validation.data.idempotencyKey,
                    paymentMethod: validation.data.method,
                    currency: 'ETB',
                    provider: validation.data.method === 'CASH' ? 'cash' : 'chapa',
                });

                return {
                    success: result.success,
                    message: result.success ? 'Payment initiated successfully' : result.error,
                    payment: result.payment,
                    redirectUrl: result.redirectUrl,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    payment: null,
                };
            }
        },

        updatePaymentStatus: async (
            _: unknown,
            args: { id: string; status: string; transactionId?: string; metadata?: unknown },
            context: GraphQLContext
        ) => {
            try {
                // Authorization: Require authentication
                const authContext = requireAuth(context);

                // Validate status
                const validStatuses = [
                    'pending',
                    'processing',
                    'captured',
                    'failed',
                    'refunded',
                    'cancelled',
                ];
                if (!validStatuses.includes(args.status)) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', `Invalid status: ${args.status}`),
                        payment: null,
                    };
                }

                // Update payment status
                const payment = await paymentsService.updatePaymentStatus(
                    args.id,
                    args.status as PaymentStatus,
                    args.transactionId,
                    args.metadata as Record<string, unknown> | undefined,
                    authContext.user?.restaurantId
                );

                return {
                    success: true,
                    message: 'Payment status updated successfully',
                    payment,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    payment: null,
                };
            }
        },

        processCashPayment: async (
            _: unknown,
            args: {
                orderId: string;
                amount: number;
                currency: string;
                restaurantId: string;
                idempotencyKey: string;
            },
            context: GraphQLContext
        ) => {
            try {
                // Authorization: Verify restaurant access
                await requireRestaurantAccess(context, args.restaurantId);

                // Process cash payment
                const result = await paymentsService.processCashPayment({
                    restaurantId: args.restaurantId,
                    orderId: args.orderId,
                    amountSantim: args.amount,
                    currency: args.currency,
                    idempotencyKey: args.idempotencyKey,
                });

                return {
                    success: result.success,
                    message: result.success ? 'Cash payment processed successfully' : result.error,
                    payment: result.payment,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    payment: null,
                };
            }
        },

        refundPayment: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
            try {
                // Authorization: Require authentication
                const authContext = requireAuth(context);

                // Refund payment
                const payment = await paymentsService.refundPayment(
                    args.id,
                    authContext.user?.restaurantId
                );

                return {
                    success: true,
                    message: 'Payment refunded successfully',
                    payment,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    payment: null,
                };
            }
        },
    },

    Payment: {
        __resolveReference: async (reference: { id: string }, context: GraphQLContext) => {
            // Federation reference resolver
            const authContext = requireAuth(context);

            // Fetch payment
            const payment = await paymentsRepository.getPayment(reference.id);

// Tenant isolation
             if (payment && authContext.user?.restaurantId) {
                 if (payment.restaurant_id !== authContext.user.restaurantId) {
                     logger.error(
                         `[payments/resolvers] Tenant isolation violation: User ${authContext.user.id} attempted to access payment ${reference.id}`,
                         undefined,
                         { source: '[payments/resolvers]' }
                     );
                     return null;
                 }
             }

            return payment;
        },

        // Computed field for display amount
        displayAmount: (parent: { amount: number; currency: string }) => {
            const formatter = new Intl.NumberFormat('en-ET', {
                style: 'currency',
                currency: parent.currency ?? 'ETB',
            });
            return formatter.format(parent.amount);
        },
    },
};
