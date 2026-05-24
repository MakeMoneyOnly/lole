import {
    createDomainEnvelope,
    type CreateDomainEnvelopeInput,
    type DomainActorRef,
    type DomainCommandEnvelope,
} from '@/lib/domain/core/contracts';
import type { KdsAction, KdsItemStatus } from '@/lib/sync/kdsSync';

export interface KdsCommandContext {
    restaurantId: string;
    locationId: string;
    deviceId: string;
    actor: DomainActorRef;
}

export interface CreateKdsItemCommandPayload {
    kds_id: string;
    order_id: string;
    order_item_id: string;
    station: string;
    priority: number;
    status: 'queued';
    display_data?: {
        menu_item_name: string;
        menu_item_name_am?: string;
        quantity: number;
        modifiers_json?: string;
        notes?: string;
    };
}

export interface UpdateKdsActionCommandPayload {
    kds_id: string;
    action: KdsAction;
    status: KdsItemStatus;
}

function buildKdsEnvelope<TPayload>(
    context: KdsCommandContext,
    aggregateId: string,
    type: 'kds.start' | 'kds.ready' | 'kds.bump' | 'kds.update',
    payload: TPayload,
    idempotencyKey: string
): DomainCommandEnvelope<TPayload> {
    const input: CreateDomainEnvelopeInput<TPayload> = {
        restaurantId: context.restaurantId,
        locationId: context.locationId,
        deviceId: context.deviceId,
        aggregate: 'kds_ticket',
        aggregateId,
        type,
        payload,
        actor: context.actor,
        idempotencyKey,
    };

    return createDomainEnvelope(input) as DomainCommandEnvelope<TPayload>;
}

export function buildCreateKdsItemCommand(
    context: KdsCommandContext,
    payload: CreateKdsItemCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<CreateKdsItemCommandPayload> {
    return buildKdsEnvelope(context, payload.kds_id, 'kds.update', payload, idempotencyKey);
}

export function buildUpdateKdsActionCommand(
    context: KdsCommandContext,
    payload: UpdateKdsActionCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<UpdateKdsActionCommandPayload> {
    const type =
        payload.action === 'start'
            ? 'kds.start'
            : payload.action === 'ready'
              ? 'kds.ready'
              : payload.action === 'bump'
                ? 'kds.bump'
                : 'kds.update';

    return buildKdsEnvelope(context, payload.kds_id, type, payload, idempotencyKey);
}
