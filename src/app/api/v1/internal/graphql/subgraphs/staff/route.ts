// Staff Subgraph API Route
// Handles GraphQL requests for the Staff domain
// This is a Federation 2 subgraph

import { staffResolvers } from '@/domains/staff/resolvers';
import { createSubgraphHandler } from '@/lib/graphql/subgraph-handler';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';

// Load the staff subgraph schema
const staffSchema = readFileSync(
    join(process.cwd(), 'graphql', 'subgraphs', 'staff.graphql'),
    'utf-8'
);

// Handler for the staff subgraph
const handler = createSubgraphHandler({
    typeDefs: staffSchema,
    resolvers: staffResolvers,
});

export async function GET(request: NextRequest): Promise<Response> {
    return handler(request as NextRequest);
}

export async function POST(request: NextRequest): Promise<Response> {
    return handler(request as NextRequest);
}








