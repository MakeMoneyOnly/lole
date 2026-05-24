import { updateOrderStatusHandler } from '@/features/operations/orders/api/update-status';

/**
 * PATCH /api/v1/merchant/operations/orders/[orderId]/status
 * Update order status.
 * Delegates to the Phase 1 API handler.
 */
export async function PATCH(
    request: Request,
    context: { params: Promise<{ orderId: string }> }
): Promise<Response> {
    return updateOrderStatusHandler(request, context);
}
