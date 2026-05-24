import { z } from 'zod';
import { ordersService } from '../domain';
import { CreateOrderRequestSchema } from '../contracts';
import type { OrderRow } from '../domain';

export async function createOrderHandler(
    input: z.infer<typeof CreateOrderRequestSchema>
): Promise<OrderRow> {
    const validated = CreateOrderRequestSchema.parse(input);
    return ordersService.createOrder(validated);
}
