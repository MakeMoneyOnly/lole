import { getOrderHandler } from '@/features/operations/orders/api/get-order';

/**
 * GET /api/v1/merchant/operations/orders/[orderId]
 * Get a single order by ID.
 * Delegates to the Phase 1 API handler.
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ orderId: string }> }
): Promise<Response> {
    return getOrderHandler(request, context);
}
