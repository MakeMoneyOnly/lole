// Guests Domain - Resolvers Layer
// GraphQL resolvers with authorization and validation
import { GraphQLError } from 'graphql';
import { GraphQLContext } from '@/lib/graphql/context';
import { requireAuth, requireRestaurantAccess } from '@/lib/graphql/authz';
import { createErrorResult, handleResolverError } from '@/lib/graphql/errors';
import {
    validateInput,
    CreateGuestInputSchema,
    UpdateGuestInputSchema,
} from '@/lib/validators/graphql';
import { enforcePaginationLimit } from '@/lib/graphql/constants';
import { guestsRepository } from './repository';
import { guestsService } from './service';
import { logger } from '@/lib/logger';

export const guestsResolvers = {
    Query: {
        guest: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
            // Authorization: Require authentication
            const authContext = requireAuth(context);

            // HIGH-021: Use DataLoader for N+1 prevention
            // DataLoader handles tenant verification internally
            const guest = await context.dataLoaders.guests.load(args.id);

            // Tenant isolation: DataLoader already verified, but double-check for safety
            if (guest && authContext.user?.restaurantId) {
                if (guest.restaurant_id !== authContext.user.restaurantId) {
                    throw new GraphQLError('Access denied to this guest', {
                        extensions: { code: 'FORBIDDEN', http: { status: 403 } },
                    });
                }
            }

            return guest;
        },

        guests: async (
            _: unknown,
            args: {
                restaurantId: string;
                first?: number;
                after?: string;
                search?: string;
            },
            context: GraphQLContext
        ) => {
            // Authorization: Verify user has access to this restaurant
            await requireRestaurantAccess(context, args.restaurantId);

            // Enforce pagination limits
            const limit = enforcePaginationLimit(args.first);
            const offset = args.after ? parseInt(args.after, 10) : 0;

            // Fetch guests list
            const guests = await guestsRepository.getGuests(args.restaurantId, {
                limit,
                offset,
                search: args.search,
            });

            // Return connection format
            return {
                edges: guests.map(guest => ({
                    node: guest,
                    cursor: Buffer.from(String(offset + guests.indexOf(guest))).toString('base64'),
                })),
                pageInfo: {
                    hasNextPage: guests.length === limit,
                    hasPreviousPage: offset > 0,
                    startCursor:
                        guests.length > 0 ? Buffer.from(String(offset)).toString('base64') : null,
                    endCursor:
                        guests.length > 0
                            ? Buffer.from(String(offset + guests.length - 1)).toString('base64')
                            : null,
                },
            };
        },

        searchGuests: async (
            _: unknown,
            args: { restaurantId: string; query: string; limit?: number },
            context: GraphQLContext
        ) => {
            // Authorization: Verify user has access to this restaurant
            await requireRestaurantAccess(context, args.restaurantId);

            // Search guests
            const guests = await guestsRepository.searchGuests(
                args.restaurantId,
                args.query,
                args.limit ?? 10
            );

            return guests;
        },
    },

    Mutation: {
        createGuest: async (_: unknown, args: { input: unknown }, context: GraphQLContext) => {
            try {
                // Validate input
                const validation = validateInput(CreateGuestInputSchema, args.input);
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        guest: null,
                    };
                }

                // Authorization: Verify user has access to this restaurant
                await requireRestaurantAccess(context, validation.data.restaurantId);

                // Create guest
                const guest = await guestsService.createGuest({
                    restaurantId: validation.data.restaurantId,
                    name: validation.data.name,
                    phone: validation.data.phone,
                    email: validation.data.email,
                    notes: validation.data.notes,
                    tags: validation.data.tags,
                });

                return {
                    success: true,
                    message: 'Guest created successfully',
                    guest,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    guest: null,
                };
            }
        },

        updateGuest: async (
            _: unknown,
            args: { id: string; input: unknown },
            context: GraphQLContext
        ) => {
            try {
                // Validate input (include id in validation)
                const validation = validateInput(UpdateGuestInputSchema, {
                    id: args.id,
                    ...(args.input as object),
                });
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        guest: null,
                    };
                }

                // Authorization: Require authentication
                const authContext = requireAuth(context);

                // Fetch existing guest and verify tenant isolation
                const existingGuest = await guestsRepository.getGuest(validation.data.id);
                if (!existingGuest) {
                    return {
                        ...createErrorResult('NOT_FOUND', 'Guest not found'),
                        guest: null,
                    };
                }

                if (existingGuest.restaurant_id !== authContext.user?.restaurantId) {
                    throw new GraphQLError('Access denied to this guest', {
                        extensions: { code: 'FORBIDDEN', http: { status: 403 } },
                    });
                }

                // Update guest
                const guest = await guestsService.updateGuest(
                    validation.data.id,
                    {
                        name: validation.data.name,
                        phone: validation.data.phone,
                        email: validation.data.email,
                        notes: validation.data.notes,
                        tags: validation.data.tags,
                    },
                    authContext.user?.restaurantId
                );

                return {
                    success: true,
                    message: 'Guest updated successfully',
                    guest,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    guest: null,
                };
            }
        },

        recordGuestVisit: async (
            _: unknown,
            args: { guestId: string; amountSpent: number },
            context: GraphQLContext
        ) => {
            try {
                // Authorization: Require authentication
                const authContext = requireAuth(context);

                // Update guest visit stats
                const guest = await guestsService.recordVisit(
                    args.guestId,
                    args.amountSpent,
                    authContext.user?.restaurantId
                );

                return {
                    success: true,
                    message: 'Visit recorded successfully',
                    guest,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    guest: null,
                };
            }
        },
    },

    Guest: {
        __resolveReference: async (reference: { id: string }, context: GraphQLContext) => {
            // Federation reference resolver
            const authContext = requireAuth(context);

            // Fetch guest
            const guest = await guestsRepository.getGuest(reference.id);

            // Tenant isolation
            if (guest && authContext.user?.restaurantId) {
                if (guest.restaurant_id !== authContext.user.restaurantId) {
                    logger.error(
                        `[guests/resolvers] Tenant isolation violation: User ${authContext.user.id} attempted to access guest ${reference.id}`,
                        undefined,
                        { source: 'guests/resolvers' }
                    );
                    return null;
                }
            }

            return guest;
        },

        // Computed field for loyalty tier
        loyaltyTier: (parent: { total_spent?: number }) => {
            const totalSpent = parent.total_spent ?? 0;
            if (totalSpent >= 100000) return 'platinum';
            if (totalSpent >= 50000) return 'gold';
            if (totalSpent >= 20000) return 'silver';
            return 'bronze';
        },
    },
};
