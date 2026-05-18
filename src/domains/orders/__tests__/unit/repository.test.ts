import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

let mockQueryBuilder: Record<string, ReturnType<typeof vi.fn>>;
let mockClient: { from: ReturnType<typeof vi.fn> };

function createQueryBuilder(): Record<string, ReturnType<typeof vi.fn>> {
    const qb: Record<string, ReturnType<typeof vi.fn>> = {};
    qb.from = vi.fn().mockReturnThis();
    qb.select = vi.fn().mockReturnThis();
    qb.insert = vi.fn().mockReturnThis();
    qb.update = vi.fn().mockReturnThis();
    qb.eq = vi.fn().mockReturnThis();
    qb.in = vi.fn().mockReturnThis();
    qb.order = vi.fn().mockReturnThis();
    qb.range = vi.fn().mockResolvedValue({ data: null, error: null });
    qb.single = vi.fn().mockResolvedValue({ data: null, error: null });
    qb.select_result = vi.fn().mockReturnThis();
    return qb;
}

vi.mock('@/lib/db/repository-base', () => ({
    getRepositoryClient: vi.fn(() => mockClient),
    normalizePagination: vi.fn((params?: { limit?: number; offset?: number }) => ({
        limit: Math.min(params?.limit ?? 50, 200),
        offset: params?.offset ?? 0,
    })),
}));

vi.mock('@/lib/constants/query-columns', () => ({
    ORDER_LIST_COLUMNS: ['id', 'status'],
    ORDER_DETAIL_COLUMNS: ['id', 'status'],
    ORDER_KDS_COLUMNS: ['id', 'status'],
    ORDER_ITEM_LIST_COLUMNS: ['id', 'order_id'],
    ORDER_ITEM_KDS_COLUMNS: ['id', 'station'],
    columnsToString: vi.fn((cols: readonly string[]) => cols.join(',')),
}));

describe('OrdersRepository', () => {
    beforeEach(() => {
        vi.resetModules();
        mockQueryBuilder = createQueryBuilder();
        mockClient = { from: vi.fn().mockReturnValue(mockQueryBuilder) };
    });

    async function importRepo() {
        const { OrdersRepository } = await import('../../repository');
        return new OrdersRepository();
    }

    describe('findById', () => {
        it('returns order data when found', async () => {
            const orderData = { id: 'order-1', status: 'pending' };
            mockQueryBuilder.single.mockResolvedValue({ data: orderData, error: null });

            const repo = await importRepo();
            const result = await repo.findById('order-1');

            expect(result).toEqual(orderData);
            expect(mockClient.from).toHaveBeenCalledWith('orders');
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'order-1');
            expect(mockQueryBuilder.single).toHaveBeenCalled();
        });

        it('returns null when order not found', async () => {
            mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });

            const repo = await importRepo();
            const result = await repo.findById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('findByRestaurant', () => {
        it('returns orders with default pagination', async () => {
            const orders = [{ id: 'o1' }, { id: 'o2' }];
            mockQueryBuilder.range.mockResolvedValue({ data: orders, error: null });

            const repo = await importRepo();
            const result = await repo.findByRestaurant('rest-1');

            expect(result).toEqual(orders);
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
            expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
            expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 49);
        });

        it('applies status filter when provided', async () => {
            mockQueryBuilder.range.mockResolvedValue({ data: [], error: null });

            const repo = await importRepo();
            await repo.findByRestaurant('rest-1', { status: 'pending' });

            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'pending');
        });

        it('applies tableNumber filter when provided', async () => {
            mockQueryBuilder.range.mockResolvedValue({ data: [], error: null });

            const repo = await importRepo();
            await repo.findByRestaurant('rest-1', { tableNumber: '5' });

            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('table_number', '5');
        });

        it('applies both status and tableNumber filters', async () => {
            mockQueryBuilder.range.mockResolvedValue({ data: [], error: null });

            const repo = await importRepo();
            await repo.findByRestaurant('rest-1', { status: 'preparing', tableNumber: '3' });

            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'preparing');
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('table_number', '3');
        });

        it('uses custom limit and offset for pagination', async () => {
            mockQueryBuilder.range.mockResolvedValue({ data: [], error: null });

            const repo = await importRepo();
            await repo.findByRestaurant('rest-1', { limit: 10, offset: 20 });

            expect(mockQueryBuilder.range).toHaveBeenCalledWith(20, 29);
        });

        it('returns empty array when data is null', async () => {
            mockQueryBuilder.range.mockResolvedValue({ data: null, error: null });

            const repo = await importRepo();
            const result = await repo.findByRestaurant('rest-1');

            expect(result).toEqual([]);
        });
    });

    describe('findActiveByRestaurant', () => {
        it('returns active orders with default pagination', async () => {
            const orders = [{ id: 'o1', status: 'pending' }];
            mockQueryBuilder.range.mockResolvedValue({ data: orders, error: null });

            const repo = await importRepo();
            const result = await repo.findActiveByRestaurant('rest-1');

            expect(result).toEqual(orders);
            expect(mockQueryBuilder.in).toHaveBeenCalledWith('status', [
                'pending',
                'confirmed',
                'preparing',
                'ready',
            ]);
            expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
            expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 49);
        });

        it('applies custom pagination', async () => {
            mockQueryBuilder.range.mockResolvedValue({ data: [], error: null });

            const repo = await importRepo();
            await repo.findActiveByRestaurant('rest-1', { limit: 25, offset: 50 });

            expect(mockQueryBuilder.range).toHaveBeenCalledWith(50, 74);
        });

        it('returns empty array when no active orders', async () => {
            mockQueryBuilder.range.mockResolvedValue({ data: null, error: null });

            const repo = await importRepo();
            const result = await repo.findActiveByRestaurant('rest-1');

            expect(result).toEqual([]);
        });
    });

    describe('findByKDSStation', () => {
        it('returns orders filtered by KDS station with default pagination', async () => {
            const orders = [{ id: 'o1', status: 'preparing' }];
            mockQueryBuilder.range.mockResolvedValue({ data: orders, error: null });

            const repo = await importRepo();
            const result = await repo.findByKDSStation('rest-1', 'grill');

            expect(result).toEqual(orders);
            expect(mockQueryBuilder.in).toHaveBeenCalledWith('status', [
                'pending',
                'confirmed',
                'preparing',
                'ready',
            ]);
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('order_items.station', 'grill');
            expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 49);
        });

        it('applies custom pagination', async () => {
            mockQueryBuilder.range.mockResolvedValue({ data: [], error: null });

            const repo = await importRepo();
            await repo.findByKDSStation('rest-1', 'grill', { limit: 100, offset: 10 });

            expect(mockQueryBuilder.range).toHaveBeenCalledWith(10, 109);
        });

        it('returns empty array when no orders found', async () => {
            mockQueryBuilder.range.mockResolvedValue({ data: null, error: null });

            const repo = await importRepo();
            const result = await repo.findByKDSStation('rest-1', 'salad');

            expect(result).toEqual([]);
        });
    });

    describe('create', () => {
        it('creates an order with defaults for optional fields', async () => {
            const createdOrder = { id: 'new-1', status: 'pending' };
            mockQueryBuilder.single.mockResolvedValue({ data: createdOrder, error: null });

            const repo = await importRepo();
            const result = await repo.create({
                restaurant_id: 'rest-1',
                order_number: 'ORD-001',
                total_price: 1500,
                idempotency_key: 'key-1',
            });

            expect(result).toEqual(createdOrder);
            expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    restaurant_id: 'rest-1',
                    table_number: '',
                    order_number: 'ORD-001',
                    status: 'pending',
                    order_type: 'dine_in',
                    total_price: 1500,
                    discount_amount: 0,
                    notes: null,
                    guest_fingerprint: null,
                    items: [],
                    fire_mode: 'full',
                    idempotency_key: 'key-1',
                })
            );
        });

        it('uses provided optional fields instead of defaults', async () => {
            const createdOrder = { id: 'new-2', status: 'pending' };
            mockQueryBuilder.single.mockResolvedValue({ data: createdOrder, error: null });

            const repo = await importRepo();
            await repo.create({
                restaurant_id: 'rest-1',
                table_number: '5',
                order_number: 'ORD-002',
                order_type: 'takeout',
                total_price: 2000,
                discount_amount: 100,
                notes: 'No onions',
                guest_fingerprint: 'fp-123',
                staff_id: 'staff-1',
                idempotency_key: 'key-2',
            });

            expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    table_number: '5',
                    order_type: 'takeout',
                    discount_amount: 100,
                    notes: 'No onions',
                    guest_fingerprint: 'fp-123',
                })
            );
        });

        it('throws on error', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: null,
                error: { message: 'Insert failed', code: '23505' },
            });

            const repo = await importRepo();
            await expect(
                repo.create({
                    restaurant_id: 'rest-1',
                    order_number: 'ORD-003',
                    total_price: 500,
                    idempotency_key: 'key-3',
                })
            ).rejects.toThrow('Insert failed');
        });
    });

    describe('updateStatus', () => {
        it('updates order status with timestamp', async () => {
            const updatedOrder = { id: 'o1', status: 'preparing' };
            mockQueryBuilder.single.mockResolvedValue({ data: updatedOrder, error: null });

            const repo = await importRepo();
            const result = await repo.updateStatus('o1', 'preparing');

            expect(result).toEqual(updatedOrder);
            expect(mockQueryBuilder.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'preparing',
                    updated_at: expect.any(String),
                })
            );
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'o1');
        });

        it('throws on error', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: null,
                error: { message: 'Update failed', code: '42501' },
            });

            const repo = await importRepo();
            await expect(repo.updateStatus('o1', 'preparing')).rejects.toThrow('Update failed');
        });
    });

    describe('cancel', () => {
        it('cancels order with reason prepended to notes', async () => {
            const cancelledOrder = {
                id: 'o1',
                status: 'cancelled',
                notes: 'Cancelled: customer request',
            };
            mockQueryBuilder.single.mockResolvedValue({ data: cancelledOrder, error: null });

            const repo = await importRepo();
            const result = await repo.cancel('o1', 'customer request');

            expect(result).toEqual(cancelledOrder);
            expect(mockQueryBuilder.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'cancelled',
                    notes: 'Cancelled: customer request',
                    updated_at: expect.any(String),
                })
            );
        });

        it('cancels order with null notes when no reason provided', async () => {
            const cancelledOrder = { id: 'o2', status: 'cancelled', notes: null };
            mockQueryBuilder.single.mockResolvedValue({ data: cancelledOrder, error: null });

            const repo = await importRepo();
            const result = await repo.cancel('o2');

            expect(result).toEqual(cancelledOrder);
            expect(mockQueryBuilder.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'cancelled',
                    notes: null,
                    updated_at: expect.any(String),
                })
            );
        });

        it('cancels order with undefined reason resulting in null notes', async () => {
            const cancelledOrder = { id: 'o3', status: 'cancelled', notes: null };
            mockQueryBuilder.single.mockResolvedValue({ data: cancelledOrder, error: null });

            const repo = await importRepo();
            const result = await repo.cancel('o3', undefined);

            expect(result).toEqual(cancelledOrder);
            expect(mockQueryBuilder.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    notes: null,
                })
            );
        });

        it('throws on error', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: null,
                error: { message: 'Cancel failed', code: '42501' },
            });

            const repo = await importRepo();
            await expect(repo.cancel('o1', 'reason')).rejects.toThrow('Cancel failed');
        });
    });

    describe('getItems', () => {
        it('returns items for an order', async () => {
            const items = [
                { id: 'item-1', order_id: 'o1' },
                { id: 'item-2', order_id: 'o1' },
            ];
            mockQueryBuilder.order.mockResolvedValue({ data: items, error: null });

            const repo = await importRepo();
            const result = await repo.getItems('o1');

            expect(result).toEqual(items);
            expect(mockClient.from).toHaveBeenCalledWith('order_items');
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('order_id', 'o1');
            expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
        });

        it('returns empty array when no items found', async () => {
            mockQueryBuilder.order.mockResolvedValue({ data: null, error: null });

            const repo = await importRepo();
            const result = await repo.getItems('o1');

            expect(result).toEqual([]);
        });
    });

    describe('createItems', () => {
        it('creates items with defaults for optional fields', async () => {
            const createdItems = [{ id: 'ci-1' }, { id: 'ci-2' }];
            mockQueryBuilder.select = vi.fn().mockReturnThis();
            mockQueryBuilder.insert = vi.fn().mockReturnThis();
            const resolveObj = { data: createdItems, error: null };
            mockQueryBuilder.select.mockResolvedValue(resolveObj);
            mockQueryBuilder.insert.mockReturnThis();

            const repo = await importRepo();
            const result = await repo.createItems('rest-1', [
                {
                    order_id: 'o1',
                    item_id: 'menu-1',
                    quantity: 2,
                    price: 500,
                },
            ]);

            expect(result).toEqual(createdItems);
            expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        restaurant_id: 'rest-1',
                        order_id: 'o1',
                        item_id: 'menu-1',
                        quantity: 2,
                        price: 500,
                        modifiers: null,
                        notes: null,
                        status: 'pending',
                        station: null,
                        course: 'main',
                        name: 'Item',
                    }),
                ])
            );
        });

        it('deep clones modifiers', async () => {
            const modifiers = { size: 'large', extra: ['cheese'] };
            mockQueryBuilder.insert.mockReturnThis();
            mockQueryBuilder.select.mockReturnThis();
            mockQueryBuilder.select.mockResolvedValue({ data: [], error: null });

            const repo = await importRepo();
            await repo.createItems('rest-1', [
                {
                    order_id: 'o1',
                    item_id: 'menu-1',
                    quantity: 1,
                    price: 100,
                    modifiers,
                },
            ]);

            const insertedData = mockQueryBuilder.insert.mock.calls[0][0][0];
            expect(insertedData.modifiers).toEqual(modifiers);
            expect(insertedData.modifiers).not.toBe(modifiers);
        });

        it('uses provided optional fields instead of defaults', async () => {
            mockQueryBuilder.insert.mockReturnThis();
            mockQueryBuilder.select.mockReturnThis();
            mockQueryBuilder.select.mockResolvedValue({ data: [], error: null });

            const repo = await importRepo();
            await repo.createItems('rest-1', [
                {
                    order_id: 'o1',
                    item_id: 'menu-1',
                    quantity: 1,
                    price: 100,
                    modifiers: { spice: 'hot' },
                    notes: 'Extra spicy',
                    station: 'grill',
                    name: 'Burger',
                },
            ]);

            const insertedData = mockQueryBuilder.insert.mock.calls[0][0][0];
            expect(insertedData.modifiers).toEqual({ spice: 'hot' });
            expect(insertedData.notes).toBe('Extra spicy');
            expect(insertedData.station).toBe('grill');
            expect(insertedData.name).toBe('Burger');
        });

        it('throws on error', async () => {
            mockQueryBuilder.insert.mockReturnThis();
            mockQueryBuilder.select.mockReturnThis();
            mockQueryBuilder.select.mockResolvedValue({
                data: null,
                error: { message: 'Insert items failed', code: '23503' },
            });

            const repo = await importRepo();
            await expect(
                repo.createItems('rest-1', [
                    { order_id: 'o1', item_id: 'menu-1', quantity: 1, price: 100 },
                ])
            ).rejects.toThrow('Insert items failed');
        });

        it('returns empty array when data is null', async () => {
            mockQueryBuilder.insert.mockReturnThis();
            mockQueryBuilder.select.mockReturnThis();
            mockQueryBuilder.select.mockResolvedValue({ data: null, error: null });

            const repo = await importRepo();
            const result = await repo.createItems('rest-1', [
                { order_id: 'o1', item_id: 'menu-1', quantity: 1, price: 100 },
            ]);

            expect(result).toEqual([]);
        });
    });

    describe('getItemById', () => {
        it('returns item data when found', async () => {
            const itemData = { id: 'item-1', order_id: 'o1' };
            mockQueryBuilder.single.mockResolvedValue({ data: itemData, error: null });

            const repo = await importRepo();
            const result = await repo.getItemById('item-1');

            expect(result).toEqual(itemData);
            expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'item-1');
        });

        it('returns null on PGRST116 error (not found)', async () => {
            mockQueryBuilder.single.mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'Not found' },
            });

            const repo = await importRepo();
            const result = await repo.getItemById('nonexistent');

            expect(result).toBeNull();
        });

        it('throws on non-PGRST116 errors', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockQueryBuilder.single.mockResolvedValue({
                data: null,
                error: { code: '42501', message: 'Permission denied' },
            });

            const repo = await importRepo();
            await expect(repo.getItemById('item-1')).rejects.toThrow('Permission denied');
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('getItemsByOrderIds', () => {
        it('returns empty array when orderIds is empty', async () => {
            const repo = await importRepo();
            const result = await repo.getItemsByOrderIds([]);

            expect(result).toEqual([]);
            expect(mockClient.from).not.toHaveBeenCalled();
        });

        it('returns items for multiple order IDs', async () => {
            const items = [
                { id: 'item-1', order_id: 'o1' },
                { id: 'item-2', order_id: 'o2' },
            ];
            mockQueryBuilder.order.mockResolvedValue({ data: items, error: null });

            const repo = await importRepo();
            const result = await repo.getItemsByOrderIds(['o1', 'o2']);

            expect(result).toEqual(items);
            expect(mockQueryBuilder.in).toHaveBeenCalledWith('order_id', ['o1', 'o2']);
            expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });
        });

        it('throws on error', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mockQueryBuilder.order.mockResolvedValue({
                data: null,
                error: { message: 'Query failed', code: '42501' },
            });

            const repo = await importRepo();
            await expect(repo.getItemsByOrderIds(['o1'])).rejects.toThrow('Query failed');
            expect(consoleErrorSpy).toHaveBeenCalled();
            consoleErrorSpy.mockRestore();
        });

        it('returns empty array when data is null but no error', async () => {
            mockQueryBuilder.order.mockResolvedValue({ data: null, error: null });

            const repo = await importRepo();
            const result = await repo.getItemsByOrderIds(['o1']);

            expect(result).toEqual([]);
        });
    });
});
