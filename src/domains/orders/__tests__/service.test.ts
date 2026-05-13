import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
    mockFindByRestaurant,
    mockCreate,
    mockCreateItems,
    mockUpdateStatus,
    mockCancel,
    mockFindById,
    mockFindActiveByRestaurant,
    mockFindByKDSStation,
    mockGetItems,
    mockGetMenuItemsByIds,
    mockPublishEvent,
    mockRpc,
} = vi.hoisted(() => ({
    mockFindByRestaurant: vi.fn(),
    mockCreate: vi.fn(),
    mockCreateItems: vi.fn(),
    mockUpdateStatus: vi.fn(),
    mockCancel: vi.fn(),
    mockFindById: vi.fn(),
    mockFindActiveByRestaurant: vi.fn(),
    mockFindByKDSStation: vi.fn(),
    mockGetItems: vi.fn(),
    mockGetMenuItemsByIds: vi.fn(),
    mockPublishEvent: vi.fn(),
    mockRpc: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
        rpc: mockRpc,
        from: vi.fn(),
    })),
}));

vi.mock('../repository', () => ({
    ordersRepository: {
        findById: mockFindById,
        findByRestaurant: mockFindByRestaurant,
        findActiveByRestaurant: mockFindActiveByRestaurant,
        findByKDSStation: mockFindByKDSStation,
        create: mockCreate,
        createItems: mockCreateItems,
        updateStatus: mockUpdateStatus,
        cancel: mockCancel,
        getItems: mockGetItems,
    },
}));

vi.mock('@/lib/events/publisher', () => ({
    publishEvent: mockPublishEvent,
}));

vi.mock('../../menu/repository', () => ({
    getMenuItemsByIds: mockGetMenuItemsByIds,
}));

vi.mock('@/lib/graphql/errors', () => ({
    loleGraphQLError: class loleGraphQLError extends Error {
        code: string;
        details?: Record<string, unknown>;
        constructor(message: string, code: string, details?: Record<string, unknown>) {
            super(message);
            this.code = code;
            this.details = details;
        }
    },
}));

const mockOrder = {
    id: 'order-1',
    restaurant_id: 'rest-1',
    status: 'pending',
    total_price: 0,
    order_number: '20260416-1234',
    idempotency_key: 'idem-1',
};

async function importService() {
    const { OrdersService } = await import('../service');
    return new OrdersService();
}

describe('OrdersService', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
        process.env.SUPABASE_SECRET_KEY = 'test-key';
        mockFindByRestaurant.mockResolvedValue([]);
        mockCreate.mockResolvedValue(mockOrder);
        mockCreateItems.mockResolvedValue([]);
        mockGetMenuItemsByIds.mockResolvedValue([]);
        mockRpc.mockResolvedValue({
            data: [
                { is_valid: true, missing_groups: [], error_message: null, error_message_am: null },
            ],
            error: null,
        });
    });

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.SUPABASE_SECRET_KEY;
    });

    describe('createOrder', () => {
        it('returns existing order when idempotency key matches', async () => {
            const service = await importService();
            const existingOrder = { ...mockOrder, idempotency_key: 'idem-1' };
            mockFindByRestaurant.mockResolvedValue([existingOrder]);

            const result = await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(result).toEqual(existingOrder);
            expect(mockCreate).not.toHaveBeenCalled();
            expect(mockCreateItems).not.toHaveBeenCalled();
            expect(mockPublishEvent).not.toHaveBeenCalled();
        });

        it('creates new order when no idempotency key match', async () => {
            const service = await importService();
            mockFindByRestaurant.mockResolvedValue([
                { ...mockOrder, idempotency_key: 'other-key' },
            ]);

            const result = await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-new',
                staffId: 'staff-1',
            });

            expect(result).toEqual(mockOrder);
            expect(mockCreate).toHaveBeenCalled();
        });

        it('creates new order when repository returns empty list', async () => {
            const service = await importService();

            const result = await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockCreate).toHaveBeenCalled();
            expect(result).toEqual(mockOrder);
        });

        it('extracts modifier IDs from items with modifiers containing id', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    {
                        menuItemId: 'item-1',
                        quantity: 1,
                        modifiers: {
                            size: { id: 'mod-1', name: 'Large' },
                            spice: { id: 'mod-2', name: 'Hot' },
                        },
                    },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockRpc).toHaveBeenCalledWith('validate_required_modifiers', {
                p_menu_item_id: 'item-1',
                p_selected_modifier_ids: ['mod-1', 'mod-2'],
            });
        });

        it('passes empty selectedModifierIds for items without modifiers', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockRpc).toHaveBeenCalledWith('validate_required_modifiers', {
                p_menu_item_id: 'item-1',
                p_selected_modifier_ids: [],
            });
        });

        it('skips modifiers without id property', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    {
                        menuItemId: 'item-1',
                        quantity: 1,
                        modifiers: {
                            size: { name: 'Large' },
                            note: { text: 'extra' },
                        },
                    },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockRpc).toHaveBeenCalledWith('validate_required_modifiers', {
                p_menu_item_id: 'item-1',
                p_selected_modifier_ids: [],
            });
        });

        it('skips modifiers with falsy id', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    {
                        menuItemId: 'item-1',
                        quantity: 1,
                        modifiers: {
                            size: { id: '', name: 'Large' },
                        },
                    },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockRpc).toHaveBeenCalledWith('validate_required_modifiers', {
                p_menu_item_id: 'item-1',
                p_selected_modifier_ids: [],
            });
        });

        it('skips non-object modifier values', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    {
                        menuItemId: 'item-1',
                        quantity: 1,
                        modifiers: {
                            label: 'just a string',
                            count: 5,
                        },
                    },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockRpc).toHaveBeenCalledWith('validate_required_modifiers', {
                p_menu_item_id: 'item-1',
                p_selected_modifier_ids: [],
            });
        });

        it('throws loleGraphQLError when modifier validation fails', async () => {
            const service = await importService();
            mockRpc.mockResolvedValue({
                data: [
                    {
                        is_valid: false,
                        missing_groups: ['spice-level'],
                        error_message: 'Required modifiers not selected',
                        error_message_am: 'አስፈላጊ ማስተካከያዎች',
                    },
                ],
                error: null,
            });

            const error = await service
                .createOrder({
                    restaurantId: 'rest-1',
                    type: 'dine_in',
                    items: [
                        {
                            menuItemId: 'item-1',
                            quantity: 1,
                            modifiers: { size: { id: 'mod-1' } },
                        },
                    ],
                    idempotencyKey: 'idem-1',
                    staffId: 'staff-1',
                })
                .then(
                    () => {
                        throw new Error('should not resolve');
                    },
                    (err: unknown) => err
                );

            expect(error).toBeInstanceOf(Error);
            const gqlError = error as {
                message: string;
                code: string;
                details?: Record<string, unknown>;
            };
            expect(gqlError.message).toBe('Required modifiers not selected');
            expect(gqlError.code).toBe('BAD_USER_INPUT');
            expect(gqlError.details).toEqual({
                missingGroups: ['spice-level'],
                errorMessageAm: 'አስፈላጊ ማስተካከያዎች',
            });
            expect(mockCreate).not.toHaveBeenCalled();
        });

        it('uses default error message when RPC returns null error_message', async () => {
            const service = await importService();
            mockRpc.mockResolvedValue({
                data: [
                    {
                        is_valid: false,
                        missing_groups: [],
                        error_message: null,
                        error_message_am: null,
                    },
                ],
                error: null,
            });

            await expect(
                service.createOrder({
                    restaurantId: 'rest-1',
                    type: 'dine_in',
                    items: [
                        {
                            menuItemId: 'item-1',
                            quantity: 1,
                            modifiers: { size: { id: 'mod-1' } },
                        },
                    ],
                    idempotencyKey: 'idem-1',
                    staffId: 'staff-1',
                })
            ).rejects.toThrow('Required modifiers not selected');
        });

        it('publishes order.created event on success', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockPublishEvent).toHaveBeenCalledWith('order.created', {
                orderId: 'order-1',
                restaurantId: 'rest-1',
                status: 'pending',
            });
        });

        it('creates order items with correct data on success', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 3 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockCreateItems).toHaveBeenCalledWith(
                'rest-1',
                expect.arrayContaining([
                    expect.objectContaining({
                        order_id: 'order-1',
                        item_id: 'item-1',
                        quantity: 3,
                        price: 0,
                        status: 'pending',
                        course: 'main',
                    }),
                ])
            );
        });

        it('routes items to mapped prep stations when menu metadata exists', async () => {
            const service = await importService();
            mockGetMenuItemsByIds.mockResolvedValue([
                {
                    id: 'item-1',
                    name: 'Mixed Grill Platter',
                    price: 120,
                },
            ]);

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-station',
                staffId: 'staff-1',
            });

            expect(mockCreateItems).toHaveBeenCalledWith(
                'rest-1',
                expect.arrayContaining([
                    expect.objectContaining({
                        item_id: 'item-1',
                        station: 'grill',
                        name: 'Mixed Grill Platter',
                        price: 120,
                    }),
                ])
            );
        });

        it('passes tableId as table_number to repository', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                tableId: 'table-5',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    table_number: 'table-5',
                })
            );
        });

        it('passes empty string as table_number when tableId is not provided', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    table_number: '',
                })
            );
        });

        it('passes guestId as guest_fingerprint to repository', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
                guestId: 'guest-abc',
            });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    guest_fingerprint: 'guest-abc',
                })
            );
        });

        it('passes notes to repository', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
                notes: 'No onions please',
            });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    notes: 'No onions please',
                })
            );
        });

        it('passes order type to repository', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'takeaway',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    order_type: 'takeaway',
                })
            );
        });

        it('generates order number in YYYYMMDD-XXXX format', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 1 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            const createCall = mockCreate.mock.calls[0][0] as { order_number: string };
            expect(createCall.order_number).toMatch(/^\d{8}-\d{4}$/);
        });

        it('validates modifiers for each item in the order', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    { menuItemId: 'item-1', quantity: 1, modifiers: { size: { id: 'mod-1' } } },
                    { menuItemId: 'item-2', quantity: 2, modifiers: { spice: { id: 'mod-2' } } },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockRpc).toHaveBeenCalledTimes(2);
            expect(mockRpc).toHaveBeenCalledWith('validate_required_modifiers', {
                p_menu_item_id: 'item-1',
                p_selected_modifier_ids: ['mod-1'],
            });
            expect(mockRpc).toHaveBeenCalledWith('validate_required_modifiers', {
                p_menu_item_id: 'item-2',
                p_selected_modifier_ids: ['mod-2'],
            });
        });
    });

    describe('validateRequiredModifiers (indirect via createOrder)', () => {
        it('passes validation when RPC returns error (graceful fallback)', async () => {
            const service = await importService();
            mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC error' } });

            const result = await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    { menuItemId: 'item-1', quantity: 1, modifiers: { size: { id: 'mod-1' } } },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(result).toBeDefined();
            expect(mockCreate).toHaveBeenCalled();
        });

        it('passes validation when RPC returns empty data array', async () => {
            const service = await importService();
            mockRpc.mockResolvedValue({ data: [], error: null });

            const result = await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    { menuItemId: 'item-1', quantity: 1, modifiers: { size: { id: 'mod-1' } } },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(result).toBeDefined();
            expect(mockCreate).toHaveBeenCalled();
        });

        it('passes validation when RPC returns null data', async () => {
            const service = await importService();
            mockRpc.mockResolvedValue({ data: null, error: null });

            const result = await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    { menuItemId: 'item-1', quantity: 1, modifiers: { size: { id: 'mod-1' } } },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(result).toBeDefined();
            expect(mockCreate).toHaveBeenCalled();
        });

        it('passes validation when RPC throws exception (graceful fallback)', async () => {
            const service = await importService();
            mockRpc.mockRejectedValue(new Error('Connection failed'));

            const result = await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    { menuItemId: 'item-1', quantity: 1, modifiers: { size: { id: 'mod-1' } } },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(result).toBeDefined();
            expect(mockCreate).toHaveBeenCalled();
        });

        it('passes validation when RPC returns valid=true', async () => {
            const service = await importService();
            mockRpc.mockResolvedValue({
                data: [
                    {
                        is_valid: true,
                        missing_groups: [],
                        error_message: null,
                        error_message_am: null,
                    },
                ],
                error: null,
            });

            const result = await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    { menuItemId: 'item-1', quantity: 1, modifiers: { size: { id: 'mod-1' } } },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(result).toBeDefined();
            expect(mockCreate).toHaveBeenCalled();
        });
    });

    describe('calculateItemTotal (indirect via createOrder)', () => {
        it('calculates total as 0 with no modifiers (unitPrice hardcoded to 0)', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [{ menuItemId: 'item-1', quantity: 5 }],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockCreateItems).toHaveBeenCalledWith(
                'rest-1',
                expect.arrayContaining([expect.objectContaining({ price: 0 })])
            );
        });

        it('includes modifier priceAdjustment in total', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    {
                        menuItemId: 'item-1',
                        quantity: 2,
                        modifiers: {
                            extra: { id: 'mod-1', priceAdjustment: 50 },
                        },
                    },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockCreateItems).toHaveBeenCalledWith(
                'rest-1',
                expect.arrayContaining([expect.objectContaining({ price: 100 })])
            );
        });

        it('sums multiple modifier priceAdjustments', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    {
                        menuItemId: 'item-1',
                        quantity: 1,
                        modifiers: {
                            extra1: { id: 'mod-1', priceAdjustment: 30 },
                            extra2: { id: 'mod-2', priceAdjustment: 20 },
                        },
                    },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockCreateItems).toHaveBeenCalledWith(
                'rest-1',
                expect.arrayContaining([expect.objectContaining({ price: 50 })])
            );
        });

        it('ignores modifiers without priceAdjustment', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    {
                        menuItemId: 'item-1',
                        quantity: 3,
                        modifiers: {
                            size: { id: 'mod-1', name: 'Large' },
                        },
                    },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockCreateItems).toHaveBeenCalledWith(
                'rest-1',
                expect.arrayContaining([expect.objectContaining({ price: 0 })])
            );
        });

        it('calculates total_price across multiple items', async () => {
            const service = await importService();

            await service.createOrder({
                restaurantId: 'rest-1',
                type: 'dine_in',
                items: [
                    {
                        menuItemId: 'item-1',
                        quantity: 2,
                        modifiers: { extra: { priceAdjustment: 25 } },
                    },
                    {
                        menuItemId: 'item-2',
                        quantity: 1,
                        modifiers: { side: { priceAdjustment: 40 } },
                    },
                ],
                idempotencyKey: 'idem-1',
                staffId: 'staff-1',
            });

            expect(mockCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    total_price: 90,
                })
            );
        });
    });

    describe('updateOrderStatus', () => {
        it('throws Error when status is empty string', async () => {
            const service = await importService();

            const input = { id: 'order-1', status: '', staffId: 'staff-1' };
            await expect(
                service.updateOrderStatus(
                    input as unknown as { id: string; status: string; staffId: string }
                )
            ).rejects.toThrow('Status is required');
        });

        it('throws Error when status is null', async () => {
            const service = await importService();

            const input = { id: 'order-1', status: null, staffId: 'staff-1' };
            await expect(
                service.updateOrderStatus(
                    input as unknown as { id: string; status: string; staffId: string }
                )
            ).rejects.toThrow('Status is required');
        });

        it('publishes status_changed event on success', async () => {
            const service = await importService();
            mockUpdateStatus.mockResolvedValue({
                ...mockOrder,
                status: 'preparing',
            });

            await service.updateOrderStatus({
                id: 'order-1',
                status: 'preparing',
                staffId: 'staff-1',
            });

            expect(mockPublishEvent).toHaveBeenCalledWith('order.status_changed', {
                orderId: 'order-1',
                restaurantId: 'rest-1',
                status: 'preparing',
                staffId: 'staff-1',
            });
        });

        it('publishes both status_changed and completed events when status is served', async () => {
            const service = await importService();
            mockUpdateStatus.mockResolvedValue({
                ...mockOrder,
                status: 'served',
                total_price: 150,
            });

            await service.updateOrderStatus({
                id: 'order-1',
                status: 'served',
                staffId: 'staff-1',
            });

            expect(mockPublishEvent).toHaveBeenCalledWith('order.status_changed', {
                orderId: 'order-1',
                restaurantId: 'rest-1',
                status: 'served',
                staffId: 'staff-1',
            });
            expect(mockPublishEvent).toHaveBeenCalledWith('order.completed', {
                orderId: 'order-1',
                restaurantId: 'rest-1',
                totalPriceSantim: 150,
            });
        });

        it('does not publish completed event for non-served status', async () => {
            const service = await importService();
            mockUpdateStatus.mockResolvedValue({
                ...mockOrder,
                status: 'preparing',
            });

            await service.updateOrderStatus({
                id: 'order-1',
                status: 'preparing',
                staffId: 'staff-1',
            });

            expect(mockPublishEvent).toHaveBeenCalledTimes(1);
            expect(mockPublishEvent).toHaveBeenCalledWith(
                'order.status_changed',
                expect.anything()
            );
            expect(mockPublishEvent).not.toHaveBeenCalledWith('order.completed', expect.anything());
        });

        it('returns the updated order from repository', async () => {
            const service = await importService();
            const updatedOrder = { ...mockOrder, status: 'ready' };
            mockUpdateStatus.mockResolvedValue(updatedOrder);

            const result = await service.updateOrderStatus({
                id: 'order-1',
                status: 'ready',
                staffId: 'staff-1',
            });

            expect(result).toEqual(updatedOrder);
            expect(mockUpdateStatus).toHaveBeenCalledWith('order-1', 'ready');
        });

        it('uses "unknown" as fallback status when order status is null', async () => {
            const service = await importService();
            mockUpdateStatus.mockResolvedValue({
                ...mockOrder,
                status: null,
            });

            await service.updateOrderStatus({
                id: 'order-1',
                status: 'preparing',
                staffId: 'staff-1',
            });

            expect(mockPublishEvent).toHaveBeenCalledWith(
                'order.status_changed',
                expect.objectContaining({
                    status: 'unknown',
                })
            );
        });
    });

    describe('cancelOrder', () => {
        it('cancels order and publishes cancelled event with reason', async () => {
            const service = await importService();
            mockCancel.mockResolvedValue({
                ...mockOrder,
                status: 'cancelled',
            });

            const result = await service.cancelOrder({
                id: 'order-1',
                reason: 'Kitchen delay',
                staffId: 'staff-1',
            });

            expect(mockCancel).toHaveBeenCalledWith('order-1', 'Kitchen delay');
            expect(mockPublishEvent).toHaveBeenCalledWith('order.cancelled', {
                orderId: 'order-1',
                restaurantId: 'rest-1',
                reason: 'Kitchen delay',
                staffId: 'staff-1',
            });
            expect(result.status).toBe('cancelled');
        });

        it('cancels order without reason', async () => {
            const service = await importService();
            mockCancel.mockResolvedValue({
                ...mockOrder,
                status: 'cancelled',
            });

            await service.cancelOrder({ id: 'order-1', staffId: 'staff-1' });

            expect(mockCancel).toHaveBeenCalledWith('order-1', undefined);
            expect(mockPublishEvent).toHaveBeenCalledWith(
                'order.cancelled',
                expect.objectContaining({
                    reason: undefined,
                })
            );
        });

        it('returns the cancelled order from repository', async () => {
            const service = await importService();
            const cancelledOrder = { ...mockOrder, status: 'cancelled' };
            mockCancel.mockResolvedValue(cancelledOrder);

            const result = await service.cancelOrder({
                id: 'order-1',
                reason: 'Test',
                staffId: 'staff-1',
            });

            expect(result).toEqual(cancelledOrder);
        });
    });

    describe('delegation methods', () => {
        it('delegates getOrder to repository.findById', async () => {
            const service = await importService();
            mockFindById.mockResolvedValue(mockOrder);

            const result = await service.getOrder('order-1');

            expect(mockFindById).toHaveBeenCalledWith('order-1');
            expect(result).toEqual(mockOrder);
        });

        it('delegates getOrder and returns null when not found', async () => {
            const service = await importService();
            mockFindById.mockResolvedValue(null);

            const result = await service.getOrder('nonexistent');

            expect(mockFindById).toHaveBeenCalledWith('nonexistent');
            expect(result).toBeNull();
        });

        it('delegates getOrders to repository.findByRestaurant with mapped options', async () => {
            const service = await importService();
            mockFindByRestaurant.mockResolvedValue([mockOrder]);

            const result = await service.getOrders('rest-1', {
                status: 'pending',
                tableId: 't-1',
                limit: 10,
                offset: 5,
            });

            expect(mockFindByRestaurant).toHaveBeenCalledWith(
                'rest-1',
                expect.objectContaining({
                    status: 'pending',
                    tableNumber: 't-1',
                    tableId: 't-1',
                    limit: 10,
                    offset: 5,
                })
            );
            expect(result).toEqual([mockOrder]);
        });

        it('delegates getOrders with default empty options', async () => {
            const service = await importService();
            mockFindByRestaurant.mockResolvedValue([]);

            await service.getOrders('rest-1');

            expect(mockFindByRestaurant).toHaveBeenCalledWith(
                'rest-1',
                expect.objectContaining({
                    tableNumber: undefined,
                })
            );
        });

        it('delegates getActiveOrders to repository.findActiveByRestaurant', async () => {
            const service = await importService();
            mockFindActiveByRestaurant.mockResolvedValue([mockOrder]);

            const result = await service.getActiveOrders('rest-1');

            expect(mockFindActiveByRestaurant).toHaveBeenCalledWith('rest-1');
            expect(result).toEqual([mockOrder]);
        });

        it('delegates getKDSOrders to repository.findByKDSStation', async () => {
            const service = await importService();
            mockFindByKDSStation.mockResolvedValue([mockOrder]);

            const result = await service.getKDSOrders('rest-1', 'grill');

            expect(mockFindByKDSStation).toHaveBeenCalledWith('rest-1', 'grill');
            expect(result).toEqual([mockOrder]);
        });

        it('delegates getOrderItems to repository.getItems', async () => {
            const service = await importService();
            const mockItems = [{ id: 'oi-1', order_id: 'order-1' }];
            mockGetItems.mockResolvedValue(mockItems);

            const result = await service.getOrderItems('order-1');

            expect(mockGetItems).toHaveBeenCalledWith('order-1');
            expect(result).toEqual(mockItems);
        });
    });
});
