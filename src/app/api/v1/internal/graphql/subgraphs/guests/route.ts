// Guests Subgraph API Route
// Handles GraphQL requests for the Guests domain
// This is a Federation 2 subgraph

import { NextRequest } from 'next/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import { readFileSync } from 'fs';
import { join } from 'path';
import { guestsResolvers } from '@/domains/guests/resolvers';
import type { GraphQLContext } from '@/lib/graphql/context';
import { createDataLoaders } from '@/lib/graphql/dataloaders';
import { createSubgraphServer } from '@/lib/graphql/apollo-config';

// Load the guests subgraph schema
const guestsSchema = readFileSync(
    join(process.cwd(), 'graphql', 'subgraphs', 'guests.graphql'),
    'utf-8'
);

// Create Apollo Server for guests subgraph with shared security configuration
const server = createSubgraphServer({
    typeDefs: guestsSchema,
    resolvers: guestsResolvers,
});

// Handler for the guests subgraph
const handler = startServerAndCreateNextHandler<NextRequest, GraphQLContext>(server, {
    context: async (req: NextRequest): Promise<GraphQLContext> => {
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
                    role: userRole || undefined,
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

export async function GET(request: NextRequest) {
    return handler(request);
}

export async function POST(request: NextRequest) {
    return handler(request);
}
