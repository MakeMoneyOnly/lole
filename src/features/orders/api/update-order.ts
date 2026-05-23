import { z } from 'zod';
import { ordersService } from '../domain';
import { UpdateOrderStatusRequestSchema, CancelOrderRequestSchema } from '../contracts';

export async function updateOrderHandler(input: z.infer<typeof UpdateOrderStatusRequestSchema>) {
    const validated = UpdateOrderStatusRequestSchema.parse(input);
    return ordersService.updateOrderStatus(validated);
}

export async function cancelOrderHandler(input: z.infer<typeof CancelOrderRequestSchema>) {
    const validated = CancelOrderRequestSchema.parse(input);
    return ordersService.cancelOrder(validated);
}
