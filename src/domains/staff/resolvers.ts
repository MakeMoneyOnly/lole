// Staff Domain - Resolvers Layer
// GraphQL resolvers with authorization and validation
import { GraphQLError } from 'graphql';
import { GraphQLContext } from '@/lib/graphql/context';
import { requireAuth, requireRestaurantAccess } from '@/lib/graphql/authz';
import {
    createErrorResult,
    handleResolverError,
    NOT_IMPLEMENTED_ERROR as _NOT_IMPLEMENTED_ERROR,
} from '@/lib/graphql/errors';
import {
    validateInput,
    CreateStaffInputSchema,
    UpdateStaffInputSchema,
} from '@/lib/validators/graphql';
import { enforcePaginationLimit } from '@/lib/graphql/constants';
import { staffRepository } from './repository';
import { staffService } from './service';
import { logger } from '@/lib/logger';

export const staffResolvers = {
    Query: {
        staffMember: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
            // Authorization: Require authentication
            const authContext = requireAuth(context);

            // Fetch staff member
            const staff = await staffRepository.getStaffMember(args.id);

            // Tenant isolation: Verify user has access to this staff member's restaurant
            if (staff && authContext.user?.restaurantId) {
                if (staff.restaurant_id !== authContext.user.restaurantId) {
                    throw new GraphQLError('Access denied to this staff member', {
                        extensions: { code: 'FORBIDDEN', http: { status: 403 } },
                    });
                }
            }

            return staff;
        },

        staff: async (
            _: unknown,
            args: {
                restaurantId: string;
                first?: number;
                after?: string;
                role?: string;
            },
            context: GraphQLContext
        ) => {
            // Authorization: Verify user has access to this restaurant
            await requireRestaurantAccess(context, args.restaurantId);

            // Enforce pagination limits to prevent unbounded result sets
            const limit = enforcePaginationLimit(args.first);
            const offset = args.after ? parseInt(args.after, 10) : 0;

            // Fetch staff list
            const staff = await staffRepository.getStaff(args.restaurantId, {
                role: args.role,
                limit,
                offset,
            });

            // Return connection format
            return {
                edges: staff.map(member => ({
                    node: member,
                    cursor: Buffer.from(String(offset + staff.indexOf(member))).toString('base64'),
                })),
                pageInfo: {
                    hasNextPage: staff.length === limit,
                    hasPreviousPage: offset > 0,
                    startCursor:
                        staff.length > 0 ? Buffer.from(String(offset)).toString('base64') : null,
                    endCursor:
                        staff.length > 0
                            ? Buffer.from(String(offset + staff.length - 1)).toString('base64')
                            : null,
                },
            };
        },
    },

    Mutation: {
        createStaffMember: async (
            _: unknown,
            args: { input: unknown },
            context: GraphQLContext
        ) => {
            try {
                // Validate input
                const validation = validateInput(CreateStaffInputSchema, args.input);
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        staffMember: null,
                    };
                }

                // Authorization: Verify user has access to this restaurant
                await requireRestaurantAccess(context, validation.data.restaurantId);

                // Create staff member
                const staffMember = await staffService.createStaffMember({
                    restaurantId: validation.data.restaurantId,
                    name: validation.data.fullName,
                    email: validation.data.email,
                    role: validation.data.role,
                    phone: validation.data.phone,
                });

                return {
                    success: true,
                    message: 'Staff member created successfully',
                    staffMember,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    staffMember: null,
                };
            }
        },

        updateStaffMember: async (
            _: unknown,
            args: { id: string; input: unknown },
            context: GraphQLContext
        ) => {
            try {
                // Validate input (include id in validation)
                const validation = validateInput(UpdateStaffInputSchema, {
                    id: args.id,
                    ...(args.input as object),
                });
                if (!validation.success) {
                    return {
                        ...createErrorResult('VALIDATION_ERROR', validation.error),
                        staffMember: null,
                    };
                }

                // Authorization: Require authentication
                const authContext = requireAuth(context);

                // Fetch existing staff member and verify tenant isolation
                const existingStaff = await staffRepository.getStaffMember(validation.data.id);
                if (!existingStaff) {
                    return {
                        ...createErrorResult('NOT_FOUND', 'Staff member not found'),
                        staffMember: null,
                    };
                }

                if (existingStaff.restaurant_id !== authContext.user?.restaurantId) {
                    throw new GraphQLError('Access denied to this staff member', {
                        extensions: { code: 'FORBIDDEN', http: { status: 403 } },
                    });
                }

                // Update staff member
                const staffMember = await staffService.updateStaffMember(
                    validation.data.id,
                    {
                        name: validation.data.fullName,
                        email: validation.data.email,
                        role: validation.data.role,
                        phone: validation.data.phone,
                    },
                    authContext.user?.restaurantId
                );

                return {
                    success: true,
                    message: 'Staff member updated successfully',
                    staffMember,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    staffMember: null,
                };
            }
        },

        deactivateStaffMember: async (
            _: unknown,
            args: { id: string },
            context: GraphQLContext
        ) => {
            try {
                // Authorization: Require authentication
                const authContext = requireAuth(context);

                // Fetch existing staff member and verify tenant isolation
                const existingStaff = await staffRepository.getStaffMember(args.id);
                if (!existingStaff) {
                    return {
                        ...createErrorResult('NOT_FOUND', 'Staff member not found'),
                        staffMember: null,
                    };
                }

                if (existingStaff.restaurant_id !== authContext.user?.restaurantId) {
                    throw new GraphQLError('Access denied to this staff member', {
                        extensions: { code: 'FORBIDDEN', http: { status: 403 } },
                    });
                }

                // Deactivate staff member
                const staffMember = await staffService.deactivateStaffMember(
                    args.id,
                    authContext.user?.restaurantId
                );

                return {
                    success: true,
                    message: 'Staff member deactivated successfully',
                    staffMember,
                };
            } catch (error) {
                if (error instanceof GraphQLError) {
                    throw error;
                }
                return {
                    ...handleResolverError(error),
                    staffMember: null,
                };
            }
        },
    },

    StaffMember: {
        __resolveReference: async (reference: { id: string }, context: GraphQLContext) => {
            // Federation reference resolver
            const authContext = requireAuth(context);

            // Fetch staff member
            const staff = await staffRepository.getStaffMember(reference.id);

            // Tenant isolation
            if (staff && authContext.user?.restaurantId) {
                if (staff.restaurant_id !== authContext.user.restaurantId) {
                    logger.error(
                        `[staff/resolvers] Tenant isolation violation: User ${authContext.user.id} attempted to access staff ${reference.id}`,
                        undefined,
                        { source: 'staff/resolvers' }
                    );
                    return null;
                }
            }

            return staff;
        },
    },
};
