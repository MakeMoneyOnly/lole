import { cancelOrderHandler } from '@/features/operations/orders/api/cancel-order';

/**
 * PATCH /api/v1/merchant/operations/orders/[orderId]/cancel
 * Cancel an order.
 * Delegates to the Phase 1 API handler.
 */
export async function PATCH(
    request: Request,
    context: { params: Promise<{ orderId: string }> }
): Promise<Response> {
    return cancelOrderHandler(request, context);
}
