import { z } from 'zod';
import { ordersService } from '../domain';
import { UpdateOrderStatusRequestSchema, CancelOrderRequestSchema } from '../contracts';
import type { OrderRow } from '../domain';

export async function updateOrderHandler(
    input: z.infer<typeof UpdateOrderStatusRequestSchema>
): Promise<OrderRow> {
    const validated = UpdateOrderStatusRequestSchema.parse(input);
    return ordersService.updateOrderStatus(validated);
}

export async function cancelOrderHandler(
    input: z.infer<typeof CancelOrderRequestSchema>
): Promise<OrderRow> {
    const validated = CancelOrderRequestSchema.parse(input);
    return ordersService.cancelOrder(validated);
}
