/**
 * API Documentation Route — BKND-010
 * Serves auto-generated OpenAPI 3.1 spec for the lole Restaurant OS API.
 *
 * Schema source: src/lib/docs/openapi-generated.json
 * Regenerate: npx tsx scripts/tools/generate-openapi.ts
 * Interactive UI: /api/docs/ui
 *
 * Covers: Orders, Payments, Menu, Staff, Guests, Table Sessions,
 *         Webhooks, Health, KDS, Loyalty, Delivery
 */

import { apiSuccess } from '@/lib/api/response';
import openApiSpec from '@/lib/docs/openapi-generated.json';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
    return apiSuccess(openApiSpec);
}








