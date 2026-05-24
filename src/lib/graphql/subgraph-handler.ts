// Shared utility for creating GraphQL subgraph handlers
// Reduces boilerplate for individual subgraph routes

import { NextRequest } from 'next/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { createSubgraphServer } from './apollo-config';
import type { GraphQLContext } from './context';
import { createDataLoaders } from './dataloaders';
import { STAFF_ROLES } from '@/types/status';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResolversType = Record<string, any>;

export interface SubgraphConfig {
    typeDefs: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolvers: Record<string, any>;
}

/**
 * Validates that a string is a valid StaffRole
 */
function isValidStaffRole(role: string | null): role is (typeof STAFF_ROLES)[number] {
    return role !== null && STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]);
}

/**
 * Creates a Next.js API handler for a GraphQL subgraph
 */
export function createSubgraphHandler(
    config: SubgraphConfig
): (req: NextRequest) => Promise<Response> {
    const server = createSubgraphServer(config);

    return startServerAndCreateNextHandler<NextRequest, GraphQLContext>(server, {
        context: async (req: NextRequest): Promise<GraphQLContext> => {
            // Extract user info from headers (set by Apollo Router)
            const userId = req.headers.get('x-user-id');
            const userRole = req.headers.get('x-user-role');
            const restaurantId = req.headers.get('x-restaurant-id');
            const guestSession = req.headers.get('x-guest-session');
            const authHeader = req.headers.get('authorization');

            // Create fresh DataLoaders for this request with tenant context
            // Use a default restaurant ID for guest sessions, or the provided one for authenticated users
            const effectiveRestaurantId = restaurantId || 'guest-session';
            const dataLoaders = createDataLoaders({ restaurantId: effectiveRestaurantId });

            if (guestSession) {
                return {
                    token: authHeader?.replace('Bearer ', '') || null,
                    guestSession,
                    user: null,
                    dataLoaders,
                };
            }

            if (userId && restaurantId) {
                return {
                    token: authHeader?.replace('Bearer ', '') || null,
                    guestSession: null,
                    user: {
                        id: userId,
                        restaurantId,
                        role: isValidStaffRole(userRole) ? userRole : undefined,
                    },
                    dataLoaders,
                };
            }

            return {
                token: null,
                guestSession: null,
                user: null,
                dataLoaders,
            };
        },
    });
}
