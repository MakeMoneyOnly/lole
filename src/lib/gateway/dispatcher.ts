import { logger } from '@/lib/logger';
import { getStoreGatewayService } from '@/lib/gateway/service';

export interface DispatchableDomainCommand {
    id?: string;
    type: string;
    aggregate: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    restaurantId: string;
    locationId: string;
    idempotencyKey?: string;
}

export function isDispatchableDomainCommand(value: unknown): value is DispatchableDomainCommand {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Record<string, unknown>;
    return (
        (candidate.id === undefined || typeof candidate.id === 'string') &&
        typeof candidate.type === 'string' &&
        typeof candidate.aggregate === 'string' &&
        typeof candidate.aggregateId === 'string' &&
        typeof candidate.restaurantId === 'string' &&
        typeof candidate.locationId === 'string' &&
        typeof candidate.payload === 'object' &&
        candidate.payload !== null
    );
}

export async function dispatchGatewayDomainCommand(
    command: DispatchableDomainCommand
): Promise<void> {
    const service = getStoreGatewayService();
    if (!service) {
        logger.warn('[Gateway] Service not configured, skipping command dispatch', {
            type: command.type,
        });
        return;
    }

    await service.publishCommand(command);
}
