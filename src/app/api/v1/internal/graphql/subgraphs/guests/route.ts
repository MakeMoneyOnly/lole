// Guests Subgraph API Route
// Handles GraphQL requests for the Guests domain
// This is a Federation 2 subgraph

import { guestsResolvers } from '@/domains/guests/resolvers';
import { createSubgraphHandler } from '@/lib/graphql/subgraph-handler';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load the guests subgraph schema
const guestsSchema = readFileSync(
    join(process.cwd(), 'graphql', 'subgraphs', 'guests.graphql'),
    'utf-8'
);

// Handler for the guests subgraph
const handler = createSubgraphHandler({
    typeDefs: guestsSchema,
    resolvers: guestsResolvers,
});

export async function GET(request: Request) {
    return handler(request);
}

export async function POST(request: Request) {
    return handler(request);
}
