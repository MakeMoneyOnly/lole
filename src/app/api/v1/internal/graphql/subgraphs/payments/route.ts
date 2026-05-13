// Payments Subgraph API Route
// Handles GraphQL requests for the Payments domain
// This is a Federation 2 subgraph

import { paymentsResolvers } from '@/domains/payments/resolvers';
import { createSubgraphHandler } from '@/lib/graphql/subgraph-handler';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load the payments subgraph schema
const paymentsSchema = readFileSync(
    join(process.cwd(), 'graphql', 'subgraphs', 'payments.graphql'),
    'utf-8'
);

// Handler for the payments subgraph
const handler = createSubgraphHandler({
    typeDefs: paymentsSchema,
    resolvers: paymentsResolvers,
});

export async function GET(request: Request) {
    return handler(request);
}

export async function POST(request: Request) {
    return handler(request);
}
