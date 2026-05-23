// Orders Domain - Public API
export { ordersRepository, OrdersRepository } from './repository';
export type { OrderRow, OrderItemRow } from './repository';
export { ordersService, OrdersService } from './service';
export type { CreateOrderInput, UpdateOrderStatusInput, CancelOrderInput } from './service';
export { ordersResolvers } from './resolvers';

// Application Layer
export {
    OrdersApplicationService,
    ordersApplicationService,
} from './application/orders-application-service';
export type {
    GetOrdersQuery,
    GetOrderByIdQuery,
    CreateOrderCommand,
    UpdateOrderStatusCommand,
    CancelOrderCommand,
    GetActiveOrdersQuery,
    GetKDSOrdersQuery,
    OrderListResponse,
} from './application/orders-application-service';
