// Orders Subgraph API Route
// Handles GraphQL requests for the Orders domain
// This is a Federation 2 subgraph

import { ordersResolvers } from '@/domains/orders/resolvers';
import { createSubgraphHandler } from '@/lib/graphql/subgraph-handler';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';

// Load the orders subgraph schema
const ordersSchema = readFileSync(
    join(process.cwd(), 'graphql', 'subgraphs', 'orders.graphql'),
    'utf-8'
);

// Handler for the orders subgraph
const handler = createSubgraphHandler({
    typeDefs: ordersSchema,
    resolvers: ordersResolvers,
});

export async function GET(request: NextRequest): Promise<Response> {
    return handler(request as NextRequest);
}

export async function POST(request: NextRequest): Promise<Response> {
    return handler(request as NextRequest);
}
