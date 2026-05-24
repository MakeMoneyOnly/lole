import {
    createDomainEnvelope,
    type CreateDomainEnvelopeInput,
    type DomainActorRef,
    type DomainCommandEnvelope,
} from '@/lib/domain/core/contracts';
import type { OfflineOrderStatus } from '@/lib/sync/orderSync';

export interface OfflineOrderCommandContext {
    restaurantId: string;
    locationId: string;
    deviceId: string;
    actor: DomainActorRef;
}

export interface OfflineOrderDraftItem {
    menu_item_id: string;
    menu_item_name: string;
    menu_item_name_am?: string;
    quantity: number;
    unit_price_santim: number;
    total_price_santim: number;
    modifiers_json?: string;
    notes?: string;
    station?: string;
}

export interface OfflineOrderDraft {
    restaurant_id: string;
    table_number?: number;
    guest_name?: string;
    guest_phone?: string;
    order_type?: string;
    subtotal_santim: number;
    discount_santim?: number;
    vat_santim: number;
    total_santim: number;
    notes?: string;
    items: OfflineOrderDraftItem[];
}

export interface CreateOfflineOrderCommandPayload extends OfflineOrderDraft {
    order_id: string;
    order_number: number;
    guest_fingerprint?: string;
}

export interface UpdateOfflineOrderStatusCommandPayload {
    order_id: string;
    status: OfflineOrderStatus;
}

export interface DeleteOfflineOrderCommandPayload {
    order_id: string;
    status: 'cancelled';
}

export interface FireOrderCourseCommandPayload {
    order_id: string;
    fire_mode: 'auto' | 'manual';
    current_course: 'appetizer' | 'main' | 'dessert' | 'beverage' | 'side';
    status: OfflineOrderStatus;
}

function buildOrderEnvelope<TPayload>(
    context: OfflineOrderCommandContext,
    aggregateId: string,
    type: 'order.create' | 'order.update' | 'order.delete' | 'order.fire_course',
    payload: TPayload,
    idempotencyKey: string
): DomainCommandEnvelope<TPayload> {
    const input: CreateDomainEnvelopeInput<TPayload> = {
        restaurantId: context.restaurantId,
        locationId: context.locationId,
        deviceId: context.deviceId,
        aggregate: 'order',
        aggregateId,
        type,
        payload,
        actor: context.actor,
        idempotencyKey,
    };

    return createDomainEnvelope(input) as DomainCommandEnvelope<TPayload>;
}

export function buildFireOfflineOrderCourseCommand(
    context: OfflineOrderCommandContext,
    payload: FireOrderCourseCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<FireOrderCourseCommandPayload> {
    return buildOrderEnvelope(
        context,
        payload.order_id,
        'order.fire_course',
        payload,
        idempotencyKey
    );
}

export function buildCreateOfflineOrderCommand(
    context: OfflineOrderCommandContext,
    payload: CreateOfflineOrderCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<CreateOfflineOrderCommandPayload> {
    return buildOrderEnvelope(context, payload.order_id, 'order.create', payload, idempotencyKey);
}

export function buildUpdateOfflineOrderStatusCommand(
    context: OfflineOrderCommandContext,
    payload: UpdateOfflineOrderStatusCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<UpdateOfflineOrderStatusCommandPayload> {
    return buildOrderEnvelope(context, payload.order_id, 'order.update', payload, idempotencyKey);
}

export function buildDeleteOfflineOrderCommand(
    context: OfflineOrderCommandContext,
    payload: DeleteOfflineOrderCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<DeleteOfflineOrderCommandPayload> {
    return buildOrderEnvelope(context, payload.order_id, 'order.delete', payload, idempotencyKey);
}
