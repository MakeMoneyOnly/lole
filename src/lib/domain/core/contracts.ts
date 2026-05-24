export type DomainAggregate =
    | 'order'
    | 'kds_ticket'
    | 'table_session'
    | 'device'
    | 'printer_job'
    | 'fiscal_receipt'
    | 'audit_entry';

export type DomainCommandType =
    | 'order.create'
    | 'order.update'
    | 'order.delete'
    | 'order.fire_course'
    | 'kds.start'
    | 'kds.ready'
    | 'kds.bump'
    | 'kds.update'
    | 'table.open'
    | 'table.update'
    | 'table.transfer'
    | 'table.close'
    | 'printer.enqueue'
    | 'fiscal.queue';

export type DomainEventType =
    | 'order.created'
    | 'order.updated'
    | 'order.deleted'
    | 'order.course_fired'
    | 'kds.started'
    | 'kds.ready'
    | 'kds.bumped'
    | 'kds.state_changed'
    | 'table.opened'
    | 'table.updated'
    | 'table.transferred'
    | 'table.closed'
    | 'printer.queued'
    | 'printer.printing'
    | 'printer.failed'
    | 'fiscal.signed'
    | 'fiscal.queued'
    | 'fiscal.replayed'
    | 'audit.logged';

export interface DomainActorRef {
    actorId: string;
    actorType: 'staff' | 'device' | 'system';
}

export interface DomainEnvelope<TPayload> {
    id: string;
    restaurantId: string;
    locationId: string;
    deviceId: string;
    aggregate: DomainAggregate;
    aggregateId: string;
    type: string;
    payload: TPayload;
    actor: DomainActorRef;
    idempotencyKey: string;
    causationId?: string;
    correlationId?: string;
    createdAt: string;
}

export type DomainCommandEnvelope<TPayload> = DomainEnvelope<TPayload> & {
    type: DomainCommandType;
};

export type DomainEventEnvelope<TPayload> = DomainEnvelope<TPayload> & {
    type: DomainEventType;
};

export interface CreateDomainEnvelopeInput<TPayload> {
    restaurantId: string;
    locationId: string;
    deviceId: string;
    aggregate: DomainAggregate;
    aggregateId: string;
    type: DomainCommandType | DomainEventType;
    payload: TPayload;
    actor: DomainActorRef;
    idempotencyKey: string;
    causationId?: string;
    correlationId?: string;
}

export function createDomainEnvelope<TPayload>(
    input: CreateDomainEnvelopeInput<TPayload>
): DomainEnvelope<TPayload> {
    return {
        id: crypto.randomUUID(),
        restaurantId: input.restaurantId,
        locationId: input.locationId,
        deviceId: input.deviceId,
        aggregate: input.aggregate,
        aggregateId: input.aggregateId,
        type: input.type,
        payload: input.payload,
        actor: input.actor,
        idempotencyKey: input.idempotencyKey,
        causationId: input.causationId,
        correlationId: input.correlationId,
        createdAt: new Date().toISOString(),
    };
}
