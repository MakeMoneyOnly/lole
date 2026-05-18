// Menu Subgraph API Route
// Handles GraphQL requests for the Menu domain
// This is a Federation 2 subgraph

import { menuResolvers } from '@/domains/menu/resolvers';
import { createSubgraphHandler } from '@/lib/graphql/subgraph-handler';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load the menu subgraph schema
const menuSchema = readFileSync(
    join(process.cwd(), 'graphql', 'subgraphs', 'menu.graphql'),
    'utf-8'
);

// Handler for the menu subgraph
const handler = createSubgraphHandler({
    typeDefs: menuSchema,
    resolvers: menuResolvers,
});

export async function GET(request: Request): Promise<Response> {
    return handler(request);
}

export async function POST(request:  Request): Promise<Response> {
    return handler(request);
}








