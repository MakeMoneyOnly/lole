import {
    createDomainEnvelope,
    type CreateDomainEnvelopeInput,
    type DomainActorRef,
    type DomainCommandEnvelope,
} from '@/lib/domain/core/contracts';

export interface TableCommandContext {
    restaurantId: string;
    locationId: string;
    deviceId: string;
    actor: DomainActorRef;
}

export type TableSessionStatus = 'open' | 'closed' | 'transferred';

export interface OpenTableSessionCommandPayload {
    session_id: string;
    table_id: string;
    guest_count: number;
    assigned_staff_id?: string | null;
    notes?: string | null;
}

export interface TransferTableSessionCommandPayload {
    session_id: string;
    table_id: string;
    assigned_staff_id?: string | null;
    notes?: string | null;
}

export interface UpdateTableSessionCommandPayload {
    session_id: string;
    table_id: string;
    guest_count?: number | null;
    assigned_staff_id?: string | null;
    notes?: string | null;
}

export interface CloseTableSessionCommandPayload {
    session_id: string;
    table_id: string;
    status: 'closed';
}

function buildTableEnvelope<TPayload>(
    context: TableCommandContext,
    aggregateId: string,
    type: 'table.open' | 'table.update' | 'table.transfer' | 'table.close',
    payload: TPayload,
    idempotencyKey: string
): DomainCommandEnvelope<TPayload> {
    const input: CreateDomainEnvelopeInput<TPayload> = {
        restaurantId: context.restaurantId,
        locationId: context.locationId,
        deviceId: context.deviceId,
        aggregate: 'table_session',
        aggregateId,
        type,
        payload,
        actor: context.actor,
        idempotencyKey,
    };

    return createDomainEnvelope(input) as DomainCommandEnvelope<TPayload>;
}

export function buildUpdateTableSessionCommand(
    context: TableCommandContext,
    payload: UpdateTableSessionCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<UpdateTableSessionCommandPayload> {
    return buildTableEnvelope(context, payload.session_id, 'table.update', payload, idempotencyKey);
}

export function buildOpenTableSessionCommand(
    context: TableCommandContext,
    payload: OpenTableSessionCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<OpenTableSessionCommandPayload> {
    return buildTableEnvelope(context, payload.session_id, 'table.open', payload, idempotencyKey);
}

export function buildTransferTableSessionCommand(
    context: TableCommandContext,
    payload: TransferTableSessionCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<TransferTableSessionCommandPayload> {
    return buildTableEnvelope(
        context,
        payload.session_id,
        'table.transfer',
        payload,
        idempotencyKey
    );
}

export function buildCloseTableSessionCommand(
    context: TableCommandContext,
    payload: CloseTableSessionCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<CloseTableSessionCommandPayload> {
    return buildTableEnvelope(context, payload.session_id, 'table.close', payload, idempotencyKey);
}
