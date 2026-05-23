import { ordersService } from '../domain';
import type { UpdateOrderStatusInput, CancelOrderInput } from '../contracts';

export const updateOrderService = {
    async updateStatus(input: UpdateOrderStatusInput) {
        return ordersService.updateOrderStatus(input);
    },

    async cancel(input: CancelOrderInput) {
        return ordersService.cancelOrder(input);
    },
};
