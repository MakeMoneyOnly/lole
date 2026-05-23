import { z } from 'zod';
import { ordersService } from '../domain';
import { CreateOrderRequestSchema } from '../contracts';

export async function createOrderHandler(input: z.infer<typeof CreateOrderRequestSchema>) {
    const validated = CreateOrderRequestSchema.parse(input);
    return ordersService.createOrder(validated);
}
