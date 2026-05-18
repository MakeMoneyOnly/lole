// GraphQL Authorization Helpers
// Provides authorization middleware for GraphQL resolvers

import { GraphQLError } from 'graphql';
import { GraphQLContext } from './context';
import { createClient } from '@supabase/supabase-js';

/**
 * Context with authenticated user guaranteed to be present
 */
export interface AuthorizedContext extends GraphQLContext {
    user: NonNullable<GraphQLContext['user']>;
}

/**
 * Throws an error if the user is not authenticated
 * @param context - The GraphQL context
 * @returns The context with user guaranteed to be present
 * @throws GraphQLError with UNAUTHORIZED code if not authenticated
 */
export function requireAuth(context: GraphQLContext): AuthorizedContext {
    if (!context.user) {
        throw new GraphQLError('Unauthorized', {
            extensions: { code: 'UNAUTHORIZED', http: { status: 401 } },
        });
    }
    return context as AuthorizedContext;
}

/**
 * Throws an error if the user doesn't have access to the restaurant.
 *
 * BKND-006: Multi-restaurant staff support.
 * Checks primary restaurantId match first, then queries restaurant_staff
 * table for multi-restaurant membership. Uses the user's JWT from context
 * to create an authenticated Supabase client.
 *
 * @param context - The GraphQL context
 * @param restaurantId - The restaurant ID to check access for
 * @returns The context with user guaranteed to have access to the restaurant
 * @throws GraphQLError with UNAUTHORIZED or FORBIDDEN code if access denied
 */
export async function requireRestaurantAccess(
    context: GraphQLContext,
    restaurantId: string
): Promise<AuthorizedContext> {
    const authContext = requireAuth(context);

    // Primary restaurant match — fast path
    if (authContext.user.restaurantId === restaurantId) {
        return authContext;
    }

    // Multi-restaurant staff check via database
    if (authContext.token) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

        if (supabaseUrl && supabaseKey) {
            const supabase = createClient(supabaseUrl, supabaseKey, {
                global: {
                    headers: { Authorization: `Bearer ${authContext.token}` },
                },
            });

            const { data } = await supabase
                .from('restaurant_staff')
                .select('id, role')
                .eq('user_id', authContext.user.id)
                .eq('restaurant_id', restaurantId)
                .eq('is_active', true)
                .maybeSingle();

            if (data) {
                // Update user's role to match their role in this restaurant
                authContext.user.role = data.role as AuthorizedContext['user']['role'];
                authContext.user.restaurantId = restaurantId;
                return authContext;
            }
        }
    }

    throw new GraphQLError('Access denied to restaurant', {
        extensions: {
            code: 'FORBIDDEN',
            http: { status: 403 },
            restaurantId,
        },
    });
}

/**
 * Middleware wrapper for query/mutation resolvers that require restaurant access
 * Automatically validates that the authenticated user has access to the restaurant
 * specified in args.restaurantId
 *
 * @example
 * ```typescript
 * orders: withRestaurantAccess(async (_: unknown, args, context) => {
 *     // args.restaurantId is already validated
 *     return ordersService.getOrders(args.restaurantId, {...});
 * }),
 * ```
 */
export function withRestaurantAccess<TArgs extends { restaurantId: string }, TResult>(
    resolver: (parent: unknown, args: TArgs, context: AuthorizedContext) => Promise<TResult>
): (parent: unknown, args: TArgs, context: GraphQLContext) => Promise<TResult> {
    return async (parent: unknown, args: TArgs, context: GraphQLContext) => {
        const authContext = await requireRestaurantAccess(context, args.restaurantId);
        return resolver(parent, args, authContext);
    };
}

/**
 * Verifies that an entity belongs to the user's restaurant
 * Use this for single-entity queries where restaurantId isn't in args
 *
 * @param context - The GraphQL context
 * @param entityRestaurantId - The restaurant ID from the fetched entity
 * @throws GraphQLError with FORBIDDEN code if entity belongs to different restaurant
 */
export function verifyTenantIsolation(
    context: AuthorizedContext,
    entityRestaurantId: string
): void {
    if (context.user.restaurantId !== entityRestaurantId) {
        throw new GraphQLError('Access denied to this resource', {
            extensions: {
                code: 'FORBIDDEN',
                http: { status: 403 },
            },
        });
    }
}

/**
 * Checks if the user has one of the specified roles
 * @param context - The GraphQL context
 * @param allowedRoles - Array of roles that are allowed
 * @throws GraphQLError with FORBIDDEN code if user doesn't have required role
 */
export function requireRole(context: AuthorizedContext, allowedRoles: string[]): void {
    const userRole = context.user.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
        throw new GraphQLError('Insufficient permissions', {
            extensions: {
                code: 'FORBIDDEN',
                http: { status: 403 },
                requiredRoles: allowedRoles,
            },
        });
    }
}
