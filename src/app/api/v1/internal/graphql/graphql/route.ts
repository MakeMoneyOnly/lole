// GraphQL API Route — BKND-004
// Production GraphQL API is served via Apollo Router (see router/ directory).
// Subgraph endpoints are operational at /api/subgraphs/{orders,menu,staff,payments,guests}.
// Federation schemas are in graphql/subgraphs/ and published via CI.

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess } from '@/lib/api/response';

export async function GET(_request: NextRequest) {
    return apiSuccess({
        service: 'lole GraphQL API',
        status: 'operational',
        gateway: 'apollo-router',
        available: false,
        router_url: process.env.APOLLO_ROUTER_URL ?? 'https://router.lole.app/graphql',
        subgraphs: {
            orders: { path: '/api/subgraphs/orders', status: 'operational' },
            menu: { path: '/api/subgraphs/menu', status: 'operational' },
            staff: { path: '/api/subgraphs/staff', status: 'operational' },
            payments: { path: '/api/subgraphs/payments', status: 'operational' },
            guests: { path: '/api/subgraphs/guests', status: 'operational' },
        },
        docs: 'See graphql/subgraphs/ for schema definitions and router/ for Apollo Router configuration.',
    });
}

export async function POST(_request: NextRequest) {
    return apiSuccess({
        service: 'lole GraphQL API',
        status: 'operational',
        gateway: 'apollo-router',
        available: false,
        router_url: process.env.APOLLO_ROUTER_URL ?? 'https://router.lole.app/graphql',
        subgraphs: {
            orders: { path: '/api/subgraphs/orders', status: 'operational' },
            menu: { path: '/api/subgraphs/menu', status: 'operational' },
            staff: { path: '/api/subgraphs/staff', status: 'operational' },
            payments: { path: '/api/subgraphs/payments', status: 'operational' },
            guests: { path: '/api/subgraphs/guests', status: 'operational' },
        },
        docs: 'See graphql/subgraphs/ for schema definitions and router/ for Apollo Router configuration.',
    });
}
