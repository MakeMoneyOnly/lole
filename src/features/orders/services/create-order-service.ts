import { ordersService } from '../domain';
import type { CreateOrderInput } from '../contracts';

export const createOrderService = {
    async createOrder(input: CreateOrderInput) {
        return ordersService.createOrder({
            restaurantId: input.restaurantId,
            tableId: input.tableId,
            type: input.type,
            items: input.items,
            notes: input.notes,
            idempotencyKey: input.idempotencyKey,
            staffId: input.staffId,
            guestId: input.guestId,
        });
    },
};
