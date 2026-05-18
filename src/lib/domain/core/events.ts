import {
    createDomainEnvelope,
    type CreateDomainEnvelopeInput,
    type DomainActorRef,
    type DomainEventEnvelope,
} from '@/lib/domain/core/contracts';
import type {
    CreateLocalJournalEntryInput,
    LocalJournalEntryKind,
} from '@/lib/journal/local-journal';

export const DOMAIN_EVENT_SCHEMA = 'lole.domain-event' as const;
export const DOMAIN_EVENT_SCHEMA_VERSION = 1 as const;

export interface DomainEventContext {
    restaurantId: string;
    locationId: string;
    deviceId: string;
    actor: DomainActorRef;
}

export interface OrderCreatedEventPayload {
    order_id: string;
    order_number: number;
    status: string;
    order_type: string;
    total_santim: number;
    item_count: number;
    table_number?: number | null;
}

export interface OrderUpdatedEventPayload {
    order_id: string;
    status: string;
    previous_status?: string | null;
    total_santim?: number;
    fire_mode?: string | null;
    current_course?: string | null;
}

export interface OrderDeletedEventPayload {
    order_id: string;
    status: 'cancelled' | 'deleted';
    reason?: string | null;
}

export interface OrderCourseFiredEventPayload {
    order_id: string;
    course: string;
    fired_item_ids: string[];
    fired_by_station?: string | null;
}

export interface KdsStateChangedEventPayload {
    kds_id: string;
    order_id: string;
    order_item_id: string;
    station: string;
    action: 'start' | 'ready' | 'bump' | 'recall' | 'hold' | 'update';
    status: string;
    previous_status?: string | null;
}

export interface TableSessionEventPayload {
    session_id: string;
    table_id: string;
    status: 'open' | 'transferred' | 'closed';
    guest_count?: number;
    assigned_staff_id?: string | null;
}

export interface PrinterIntentEventPayload {
    job_id: string;
    order_id: string;
    station: string;
    route: 'kitchen' | 'bar' | 'receipt' | 'other';
    status: 'queued' | 'printing' | 'completed' | 'failed';
    failure_reason?: string | null;
}

export interface FiscalIntentEventPayload {
    job_id: string;
    order_id: string;
    queue_mode: string;
    status: 'queued' | 'signed' | 'replayed' | 'failed';
    signature_algorithm?: string | null;
    warning_text?: string | null;
}

export interface AuditIntentEventPayload {
    audit_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    severity: 'info' | 'warning' | 'critical';
    metadata?: Record<string, unknown>;
}

export interface EnterpriseDomainEventPayloadMap {
    'order.created': OrderCreatedEventPayload;
    'order.updated': OrderUpdatedEventPayload;
    'order.deleted': OrderDeletedEventPayload;
    'order.course_fired': OrderCourseFiredEventPayload;
    'kds.state_changed': KdsStateChangedEventPayload;
    'table.opened': TableSessionEventPayload;
    'table.transferred': TableSessionEventPayload;
    'table.closed': TableSessionEventPayload;
    'printer.queued': PrinterIntentEventPayload;
    'printer.printing': PrinterIntentEventPayload;
    'printer.failed': PrinterIntentEventPayload;
    'fiscal.queued': FiscalIntentEventPayload;
    'fiscal.signed': FiscalIntentEventPayload;
    'fiscal.replayed': FiscalIntentEventPayload;
    'audit.logged': AuditIntentEventPayload;
}

export type EnterpriseDomainEventType = keyof EnterpriseDomainEventPayloadMap;

export type EnterpriseDomainEvent<
    TType extends EnterpriseDomainEventType = EnterpriseDomainEventType,
> = DomainEventEnvelope<EnterpriseDomainEventPayloadMap[TType]> & {
    type: TType;
    schema: typeof DOMAIN_EVENT_SCHEMA;
    schemaVersion: typeof DOMAIN_EVENT_SCHEMA_VERSION;
};

export interface CreateEnterpriseDomainEventInput<
    TType extends EnterpriseDomainEventType,
> extends Omit<CreateDomainEnvelopeInput<EnterpriseDomainEventPayloadMap[TType]>, 'type'> {
    type: TType;
}

export function createEnterpriseDomainEvent<TType extends EnterpriseDomainEventType>(
    input: CreateEnterpriseDomainEventInput<TType>
): EnterpriseDomainEvent<TType> {
    const event = createDomainEnvelope({
        ...input,
        type: input.type,
    }) as EnterpriseDomainEvent<TType>;

    return {
        ...event,
        schema: DOMAIN_EVENT_SCHEMA,
        schemaVersion: DOMAIN_EVENT_SCHEMA_VERSION,
    };
}

function getJournalKind(type: EnterpriseDomainEventType): LocalJournalEntryKind {
    if (type.startsWith('fiscal.')) {
        return 'fiscal';
    }

    if (type === 'audit.logged') {
        return 'audit';
    }

    return 'event';
}

export function toDomainEventJournalInput<TType extends EnterpriseDomainEventType>(
    event: EnterpriseDomainEvent<TType>
): CreateLocalJournalEntryInput {
    return {
        restaurantId: event.restaurantId,
        locationId: event.locationId,
        deviceId: event.deviceId,
        actorId: event.actor.actorId,
        entryKind: getJournalKind(event.type),
        aggregateType: event.aggregate,
        aggregateId: event.aggregateId,
        operationType: event.type,
        payload: event.payload as unknown as Record<string, unknown>,
        idempotencyKey: event.idempotencyKey,
    };
}

function buildEnterpriseEvent<TType extends EnterpriseDomainEventType>(
    context: DomainEventContext,
    aggregate: CreateEnterpriseDomainEventInput<TType>['aggregate'],
    aggregateId: string,
    type: TType,
    payload: EnterpriseDomainEventPayloadMap[TType],
    idempotencyKey: string
): EnterpriseDomainEvent<TType> {
    return createEnterpriseDomainEvent({
        restaurantId: context.restaurantId,
        locationId: context.locationId,
        deviceId: context.deviceId,
        aggregate,
        aggregateId,
        type,
        payload,
        actor: context.actor,
        idempotencyKey,
    });
}

export function buildOrderCreatedEvent(
    context: DomainEventContext,
    payload: OrderCreatedEventPayload,
    idempotencyKey: string
) {
    return buildEnterpriseEvent(
        context,
        'order',
        payload.order_id,
        'order.created',
        payload,
        idempotencyKey
    );
}

export function buildOrderCourseFiredEvent(
    context: DomainEventContext,
    payload: OrderCourseFiredEventPayload,
    idempotencyKey: string
) {
    return buildEnterpriseEvent(
        context,
        'order',
        payload.order_id,
        'order.course_fired',
        payload,
        idempotencyKey
    );
}

export function buildKdsStateChangedEvent(
    context: DomainEventContext,
    payload: KdsStateChangedEventPayload,
    idempotencyKey: string
) {
    return buildEnterpriseEvent(
        context,
        'kds_ticket',
        payload.kds_id,
        'kds.state_changed',
        payload,
        idempotencyKey
    );
}

export function buildPrinterQueuedEvent(
    context: DomainEventContext,
    payload: PrinterIntentEventPayload,
    idempotencyKey: string
) {
    return buildEnterpriseEvent(
        context,
        'printer_job',
        payload.job_id,
        'printer.queued',
        payload,
        idempotencyKey
    );
}

export function buildFiscalQueuedEvent(
    context: DomainEventContext,
    payload: FiscalIntentEventPayload,
    idempotencyKey: string
) {
    return buildEnterpriseEvent(
        context,
        'fiscal_receipt',
        payload.job_id,
        'fiscal.queued',
        payload,
        idempotencyKey
    );
}

export function buildAuditLoggedEvent(
    context: DomainEventContext,
    payload: AuditIntentEventPayload,
    idempotencyKey: string
) {
    return buildEnterpriseEvent(
        context,
        'audit_entry',
        payload.audit_id,
        'audit.logged',
        payload,
        idempotencyKey
    );
}
