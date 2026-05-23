export { ordersService } from '@/domains/orders/service';
export { ordersRepository } from '@/domains/orders/repository';
export type { OrderRow, OrderItemRow } from '@/domains/orders/repository';
export type {
    CreateOrderInput,
    UpdateOrderStatusInput,
    CancelOrderInput,
} from '@/domains/orders/service';
