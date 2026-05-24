import { z } from 'zod';
import { ordersService } from '../domain';
import { GetOrdersQuerySchema } from '../contracts';
import type { OrderRow } from '../domain';

export async function getOrdersHandler(
    query: z.infer<typeof GetOrdersQuerySchema>
): Promise<OrderRow[]> {
    const validated = GetOrdersQuerySchema.parse(query);
    return ordersService.getOrders(validated.restaurantId, validated);
}
