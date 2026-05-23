import { z } from 'zod';
import { ordersService } from '../domain';
import { GetOrdersQuerySchema } from '../contracts';

export async function getOrdersHandler(query: z.infer<typeof GetOrdersQuerySchema>) {
    const validated = GetOrdersQuerySchema.parse(query);
    return ordersService.getOrders(validated.restaurantId, validated);
}
