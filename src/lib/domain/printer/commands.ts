import {
    createDomainEnvelope,
    type CreateDomainEnvelopeInput,
    type DomainActorRef,
    type DomainCommandEnvelope,
} from '@/lib/domain/core/contracts';
import type { KdsPrintPayload } from '@/lib/printer/contracts';

export interface PrinterCommandContext {
    restaurantId: string;
    locationId: string;
    deviceId: string;
    actor: DomainActorRef;
}

export interface EnqueuePrinterJobCommandPayload {
    job_id: string;
    order_id: string;
    station: string;
    payload: KdsPrintPayload;
}

export function buildEnqueuePrinterJobCommand(
    context: PrinterCommandContext,
    payload: EnqueuePrinterJobCommandPayload,
    idempotencyKey: string
): DomainCommandEnvelope<EnqueuePrinterJobCommandPayload> {
    const input: CreateDomainEnvelopeInput<EnqueuePrinterJobCommandPayload> = {
        restaurantId: context.restaurantId,
        locationId: context.locationId,
        deviceId: context.deviceId,
        aggregate: 'printer_job',
        aggregateId: payload.job_id,
        type: 'printer.enqueue',
        payload,
        actor: context.actor,
        idempotencyKey,
    };

    return createDomainEnvelope(input) as DomainCommandEnvelope<EnqueuePrinterJobCommandPayload>;
}
