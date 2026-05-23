export type OrderEventType =
    | 'order.created'
    | 'order.updated'
    | 'order.status_changed'
    | 'order.cancelled'
    | 'order.completed';

export interface OrderCreatedEvent {
    orderId: string;
    restaurantId: string;
    status: string;
    createdAt: string;
}

export interface OrderStatusChangedEvent {
    orderId: string;
    restaurantId: string;
    status: string;
    previousStatus?: string;
    staffId: string;
}

export interface OrderCancelledEvent {
    orderId: string;
    restaurantId: string;
    reason?: string;
    staffId: string;
}

export interface OrderCompletedEvent {
    orderId: string;
    restaurantId: string;
    totalPriceSantim: number;
}

export type OrderEvent =
    | OrderCreatedEvent
    | OrderStatusChangedEvent
    | OrderCancelledEvent
    | OrderCompletedEvent;
