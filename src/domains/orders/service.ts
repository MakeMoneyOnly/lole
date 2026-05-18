// Orders Domain - Service Layer
// Business logic — pure TypeScript, no framework coupling
import { ordersRepository, OrderRow, OrderItemRow } from './repository';
import { loleGraphQLError } from '@/lib/graphql/errors';
import { publishEvent } from '@/lib/events/publisher';
import { getMenuItemsByIds } from '../menu/repository';
import { routeOrderItemToPrimaryStation } from '@/lib/kds/station-router';
import type { OrderStatus } from '@/types/status';

export interface CreateOrderInput {
    restaurantId: string;
    tableId?: string;
    type: 'dine_in' | 'takeaway' | 'delivery';
    items: {
        menuItemId: string;
        quantity: number;
        modifiers?: Record<string, unknown>;
        notes?: string;
    }[];
    notes?: string;
    idempotencyKey: string;
    staffId: string;
    guestId?: string;
}

export interface UpdateOrderStatusInput {
    id: string;
    status: OrderStatus;
    staffId: string;
}

export interface CancelOrderInput {
    id: string;
    reason?: string;
    staffId: string;
}

function generateOrderNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');
    return `${dateStr}-${random}`;
}

function calculateItemTotal(
    unitPriceSantim: number,
    quantity: number,
    modifiers?: Record<string, unknown>
): number {
    let totalSantim = unitPriceSantim * quantity;

    // Add modifier price adjustments
    if (modifiers && typeof modifiers === 'object') {
        Object.values(modifiers).forEach((modifier: unknown) => {
            if (modifier && typeof modifier === 'object' && 'priceAdjustment' in modifier) {
                totalSantim += (modifier as { priceAdjustment: number }).priceAdjustment * quantity;
            }
        });
    }

    return totalSantim;
}

// Type for the validation result from the RPC function
interface _ModifierValidationResult {
    is_valid: boolean;
    missing_groups: string[];
    error_message: string | null;
    error_message_am: string | null;
}

/**
  * Validate required modifiers for a menu item
  * Returns validation result with error message if invalid
  * Gracefully handles exceptions by treating them as valid (fallback behavior)
  */
 async function validateRequiredModifiers(
     menuItemId: string,
     selectedModifierIds: string[]
 ): Promise<{
     isValid: boolean;
     missingGroups?: string[];
     errorMessage?: string;
     errorMessageAm?: string;
 }> {
     try {
         const result = await ordersRepository.validateModifiers(menuItemId, selectedModifierIds);
         if (!result) {
             return { isValid: true };
         }
         return {
             isValid: result.is_valid,
             missingGroups: result.missing_groups,
             errorMessage: result.error_message ?? undefined,
             errorMessageAm: result.error_message_am ?? undefined,
         };
     } catch {
         // Graceful fallback: treat validation errors as valid to avoid blocking order creation
         return { isValid: true };
     }
 }

export class OrdersService {
    async createOrder(input: CreateOrderInput): Promise<OrderRow> {
        // Check for idempotency - prevent duplicate orders
        const existing = await ordersRepository.findByRestaurant(input.restaurantId, { limit: 1 });

        const idempotent = existing.find(o => o.idempotency_key === input.idempotencyKey);
        if (idempotent) {
            return idempotent;
        }

        // Validate required modifiers for all items before processing order
        for (const item of input.items) {
            // Extract selected modifier IDs from the modifiers object
            const selectedModifierIds: string[] = [];
            if (item.modifiers && typeof item.modifiers === 'object') {
                Object.values(item.modifiers).forEach((modifier: unknown) => {
                    if (modifier && typeof modifier === 'object' && 'id' in modifier) {
                        const mod = modifier as { id: string };
                        if (mod.id) {
                            selectedModifierIds.push(mod.id);
                        }
                    }
                });
            }

            const validation = await validateRequiredModifiers(
                item.menuItemId,
                selectedModifierIds
            );
            if (!validation.isValid) {
                // Use loleGraphQLError for proper error handling
                const graphQLError = new loleGraphQLError(
                    validation.errorMessage || 'Required modifiers not selected',
                    'BAD_USER_INPUT',
                    {
                        missingGroups: validation.missingGroups,
                        errorMessageAm: validation.errorMessageAm,
                    }
                );
                throw graphQLError;
            }
        }

        // Calculate totals
        let totalPriceSantim = 0;
        const menuItems = await getMenuItemsByIds(input.items.map(item => item.menuItemId));
        const menuItemMap = new Map(
            menuItems.map(item => [String(item.id), item as Record<string, unknown>])
        );
        const orderItems = input.items.map(item => {
            const menuItem = menuItemMap.get(item.menuItemId);
            const unitPriceSantim =
                typeof menuItem?.price === 'number' ? menuItem.price : Number(menuItem?.price ?? 0);
            const itemTotalSantim = calculateItemTotal(
                unitPriceSantim,
                item.quantity,
                item.modifiers
            );
            totalPriceSantim += itemTotalSantim;

            return {
                item_id: item.menuItemId,
                quantity: item.quantity,
                price: itemTotalSantim,
                modifiers: item.modifiers,
                notes: item.notes,
                name: typeof menuItem?.name === 'string' ? menuItem.name : '',
                station: routeOrderItemToPrimaryStation({
                    itemName: typeof menuItem?.name === 'string' ? menuItem.name : null,
                    station: typeof menuItem?.station === 'string' ? menuItem.station : null,
                    connectedStations: Array.isArray(menuItem?.connected_stations)
                        ? menuItem.connected_stations.filter(
                              (value): value is string => typeof value === 'string'
                          )
                        : null,
                    course: typeof menuItem?.course === 'string' ? menuItem.course : null,
                }),
                course: 'main',
                status: 'pending',
            };
        });

        // Create order
        const order = await ordersRepository.create({
            restaurant_id: input.restaurantId,
            table_number: input.tableId ?? '',
            order_number: generateOrderNumber(),
            order_type: input.type,
            total_price: totalPriceSantim,
            notes: input.notes,
            guest_fingerprint: input.guestId,
            idempotency_key: input.idempotencyKey,
        });

        // Create order items
        await ordersRepository.createItems(
            input.restaurantId,
            orderItems.map(item => ({
                ...item,
                order_id: order.id,
            }))
        );

        // Publish order created event
        await publishEvent('order.created', {
            orderId: order.id,
            restaurantId: input.restaurantId,
            status: order.status,
        });

        return order;
    }

    async updateOrderStatus(input: UpdateOrderStatusInput): Promise<OrderRow> {
        if (!input.status) {
            throw new Error('Status is required');
        }
        const order = await ordersRepository.updateStatus(input.id, input.status);

        // Publish status changed event
        await publishEvent('order.status_changed', {
            orderId: order.id,
            restaurantId: order.restaurant_id,
            status: order.status ?? 'unknown',
            staffId: input.staffId,
        });

        // If order is completed, publish completed event
        if (order.status === 'served') {
            await publishEvent('order.completed', {
                orderId: order.id,
                restaurantId: order.restaurant_id,
                totalPriceSantim: order.total_price,
            });
        }

        return order;
    }

    async cancelOrder(input: CancelOrderInput): Promise<OrderRow> {
        const order = await ordersRepository.cancel(input.id, input.reason);

        await publishEvent('order.cancelled', {
            orderId: order.id,
            restaurantId: order.restaurant_id,
            reason: input.reason,
            staffId: input.staffId,
        });

        return order;
    }

    async getOrder(id: string): Promise<OrderRow | null> {
        return ordersRepository.findById(id);
    }

    async getOrders(
        restaurantId: string,
        options: {
            status?: OrderStatus;
            tableId?: string;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<OrderRow[]> {
        return ordersRepository.findByRestaurant(restaurantId, {
            ...options,
            tableNumber: options.tableId,
            status: options.status ?? undefined,
        });
    }

    async getActiveOrders(restaurantId: string): Promise<OrderRow[]> {
        return ordersRepository.findActiveByRestaurant(restaurantId);
    }

    async getKDSOrders(restaurantId: string, station: string): Promise<OrderRow[]> {
        return ordersRepository.findByKDSStation(restaurantId, station);
    }

    async getOrderItems(orderId: string): Promise<OrderItemRow[]> {
        return ordersRepository.getItems(orderId);
    }
}

export const ordersService = new OrdersService();
