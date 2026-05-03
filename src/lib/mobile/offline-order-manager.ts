export interface OfflineOrder {
    id: string;
    restaurant_id: string;
    status: string;
    total_santim: number;
    version: number;
    modified_at: string;
    modified_by: string;
    deleted: boolean;
    payload: Record<string, unknown>;
}

export interface OfflineOrderItem {
    id: string;
    order_id: string;
    menu_item_id: string;
    quantity: number;
    total_price_santim: number;
    version: number;
    modified_at: string;
    modified_by: string;
    deleted: boolean;
}

export interface CreateOrderInput {
    restaurant_id: string;
    items: Array<{
        menu_item_id: string;
        quantity: number;
        unit_price_santim: number;
    }>;
    metadata?: Record<string, unknown>;
}

const ORDERS_KEY = 'lole_offline_orders_v1';
const ORDER_ITEMS_KEY = 'lole_offline_order_items_v1';

function getDeviceId(): string {
    if (typeof window === 'undefined') {
        return 'server';
    }
    return window.localStorage.getItem('lole_device_id') ?? 'unknown';
}

function generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
    return new Date().toISOString();
}

function readStore<T>(key: string): T[] {
    if (typeof window === 'undefined') {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
        return [];
    }
}

function writeStore<T>(key: string, data: T[]): void {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        window.localStorage.setItem(key, JSON.stringify(data));
    } catch {
        console.error(`[OfflineOrderManager] Failed to write ${key}.`);
    }
}

export function getOfflineOrders(restaurantId?: string): OfflineOrder[] {
    const orders = readStore<OfflineOrder>(ORDERS_KEY);
    if (restaurantId) {
        return orders.filter(o => o.restaurant_id === restaurantId && !o.deleted);
    }
    return orders.filter(o => !o.deleted);
}

export function getOfflineOrderById(orderId: string): OfflineOrder | null {
    const orders = readStore<OfflineOrder>(ORDERS_KEY);
    return orders.find(o => o.id === orderId && !o.deleted) ?? null;
}

export function getOfflineOrderItems(orderId: string): OfflineOrderItem[] {
    const items = readStore<OfflineOrderItem>(ORDER_ITEMS_KEY);
    return items.filter(i => i.order_id === orderId && !i.deleted);
}

export function createOfflineOrder(input: CreateOrderInput): OfflineOrder {
    const deviceId = getDeviceId();
    const timestamp = now();
    const orderId = generateId();

    const totalSantim = input.items.reduce(
        (sum, item) => sum + item.unit_price_santim * item.quantity,
        0
    );

    const order: OfflineOrder = {
        id: orderId,
        restaurant_id: input.restaurant_id,
        status: 'pending',
        total_santim: totalSantim,
        version: 1,
        modified_at: timestamp,
        modified_by: deviceId,
        deleted: false,
        payload: input.metadata ?? {},
    };

    const orders = readStore<OfflineOrder>(ORDERS_KEY);
    orders.push(order);
    writeStore(ORDERS_KEY, orders);

    const items = input.items.map(item => ({
        id: generateId(),
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        total_price_santim: item.unit_price_santim * item.quantity,
        version: 1,
        modified_at: timestamp,
        modified_by: deviceId,
        deleted: false,
    }));

    const allItems = readStore<OfflineOrderItem>(ORDER_ITEMS_KEY);
    allItems.push(...items);
    writeStore(ORDER_ITEMS_KEY, allItems);

    return order;
}

export function updateOfflineOrder(
    orderId: string,
    changes: Partial<Pick<OfflineOrder, 'status' | 'total_santim' | 'payload'>>
): OfflineOrder | null {
    const orders = readStore<OfflineOrder>(ORDERS_KEY);
    const index = orders.findIndex(o => o.id === orderId && !o.deleted);

    if (index < 0) {
        return null;
    }

    const deviceId = getDeviceId();
    const timestamp = now();

    orders[index] = {
        ...orders[index],
        ...changes,
        version: orders[index].version + 1,
        modified_at: timestamp,
        modified_by: deviceId,
    };

    writeStore(ORDERS_KEY, orders);
    return orders[index];
}

export function deleteOfflineOrder(orderId: string): boolean {
    const orders = readStore<OfflineOrder>(ORDERS_KEY);
    const index = orders.findIndex(o => o.id === orderId && !o.deleted);

    if (index < 0) {
        return false;
    }

    const deviceId = getDeviceId();
    const timestamp = now();

    orders[index] = {
        ...orders[index],
        deleted: true,
        version: orders[index].version + 1,
        modified_at: timestamp,
        modified_by: deviceId,
    };

    writeStore(ORDERS_KEY, orders);

    const items = readStore<OfflineOrderItem>(ORDER_ITEMS_KEY);
    const updatedItems = items.map(item =>
        item.order_id === orderId && !item.deleted
            ? {
                  ...item,
                  deleted: true,
                  version: item.version + 1,
                  modified_at: timestamp,
                  modified_by: deviceId,
              }
            : item
    );
    writeStore(ORDER_ITEMS_KEY, updatedItems);

    return true;
}

export function getPendingOfflineOrders(): OfflineOrder[] {
    return readStore<OfflineOrder>(ORDERS_KEY).filter(o => !o.deleted);
}

export function getDeletedOfflineOrders(): OfflineOrder[] {
    return readStore<OfflineOrder>(ORDERS_KEY).filter(o => o.deleted);
}

export function getOfflineOrdersForSync(): Array<{
    order: OfflineOrder;
    items: OfflineOrderItem[];
}> {
    const orders = readStore<OfflineOrder>(ORDERS_KEY);
    const items = readStore<OfflineOrderItem>(ORDER_ITEMS_KEY);

    return orders.map(order => ({
        order,
        items: items.filter(i => i.order_id === order.id),
    }));
}

export function clearSyncedOrders(syncedIds: string[]): void {
    const orders = readStore<OfflineOrder>(ORDERS_KEY);
    const items = readStore<OfflineOrderItem>(ORDER_ITEMS_KEY);

    writeStore(
        ORDERS_KEY,
        orders.filter(o => !syncedIds.includes(o.id))
    );
    writeStore(
        ORDER_ITEMS_KEY,
        items.filter(i => !syncedIds.includes(i.order_id))
    );
}
