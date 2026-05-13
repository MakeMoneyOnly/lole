import { ActivityItem } from '../types';

export type ActivityType = 'order' | 'kitchen' | 'staff' | 'request';

export interface OrderData {
    id: string | number;
    order_number: string;
    table_number: string | number;
    created_at: string;
    notes?: string;
}

export interface RequestData {
    id: string | number;
    table_number: string | number;
    request_type: string;
    created_at: string;
}

export function transformOrdersToActivities(orders: OrderData[]): ActivityItem[] {
    return orders.map(order => ({
        id: `order-${order.id}`,
        type: 'order' as ActivityType,
        user: `Order ${(order.order_number as string)?.startsWith('ORD-') ? (order.order_number as string).split('-').slice(1).join('-') : `#${order.order_number}`}`,
        action: 'placed for',
        target: `Table ${order.table_number}`,
        time: new Date(order.created_at).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        }),
        timestamp: new Date(order.created_at),
        hasMessage: !!order.notes,
        message: order.notes ? `Note: '${order.notes}'` : undefined,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Order${order.id}`,
    }));
}

export function transformRequestsToActivities(requests: RequestData[]): ActivityItem[] {
    return requests.map(req => ({
        id: `req-${req.id}`,
        type: 'request' as ActivityType,
        user: `Table ${req.table_number}`,
        action: 'requested',
        target:
            req.request_type === 'waiter'
                ? 'Waiter Assistance'
                : req.request_type === 'bill'
                  ? 'Bill'
                  : req.request_type,
        time: new Date(req.created_at).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        }),
        timestamp: new Date(req.created_at),
        hasMessage: false,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Req${req.id}`,
    }));
}

export function transformActivityData(data: {
    orders?: OrderData[];
    requests?: RequestData[];
}): ActivityItem[] {
    const orderActivities = transformOrdersToActivities(data.orders || []);
    const requestActivities = transformRequestsToActivities(data.requests || []);
    return [...orderActivities, ...requestActivities].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
}
