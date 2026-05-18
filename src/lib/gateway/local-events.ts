import { buildRestaurantTopic, type MqttScope } from '@/lib/lan/mqtt-topics';

export interface GatewayLanEventMessage<TPayload = Record<string, unknown>> {
    schema: 'lole.gateway.lan-event';
    schemaVersion: 1;
    messageId: string;
    sequence: number;
    restaurantId: string;
    locationId: string;
    aggregate: string;
    aggregateId: string;
    type: string;
    idempotencyKey?: string;
    emittedAt: string;
    payload: TPayload;
}

export interface RawGatewayCommandLike<TPayload = Record<string, unknown>> {
    id?: string;
    restaurantId: string;
    locationId: string;
    aggregate: string;
    aggregateId: string;
    type: string;
    idempotencyKey?: string;
    payload: TPayload;
}

export class LocalGatewaySequenceTracker {
    private readonly seenMessageIds = new Map<string, number>();
    private readonly latestSequenceByAggregate = new Map<string, number>();
    private lastPruneTime = Date.now();
    private readonly pruneIntervalMs: number;
    private readonly pruneInterval?: ReturnType<typeof setInterval>;

    constructor(pruneIntervalMs = 60_000) {
        this.pruneIntervalMs = pruneIntervalMs;
        this.pruneInterval = setInterval(() => {
            this.pruneExpired();
        }, pruneIntervalMs);
    }

    private pruneExpired(): void {
        const now = Date.now();
        const expiry = now - 5 * 60_000;

        for (const [messageId, timestamp] of this.seenMessageIds.entries()) {
            if (timestamp < expiry) {
                this.seenMessageIds.delete(messageId);
            }
        }

        for (const [aggregateKey, _sequence] of this.latestSequenceByAggregate.entries()) {
            if (this.seenMessageIds.size === 0) {
                this.latestSequenceByAggregate.delete(aggregateKey);
            }
        }
    }

    stop(): void {
        if (this.pruneInterval) {
            clearInterval(this.pruneInterval);
        }
    }

    shouldProcess(input: {
        messageId?: string | null;
        aggregate: string;
        aggregateId: string;
        sequence?: number | null;
    }): boolean {
        const now = Date.now();
        if (input.messageId) {
            if (this.seenMessageIds.has(input.messageId)) {
                return false;
            }
            this.seenMessageIds.set(input.messageId, now);
        }

        const aggregateKey = `${input.aggregate}:${input.aggregateId}`;
        if (typeof input.sequence === 'number') {
            const latest = this.latestSequenceByAggregate.get(aggregateKey) ?? 0;
            if (input.sequence <= latest) {
                return false;
            }
            this.latestSequenceByAggregate.set(aggregateKey, input.sequence);
        }

        if (this.seenMessageIds.size > 500) {
            this.pruneExpired();
        }

        this.lastPruneTime = now;

        return true;
    }
}

export function isGatewayLanEventMessage(value: unknown): value is GatewayLanEventMessage {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Record<string, unknown>;
    return (
        candidate.schema === 'lole.gateway.lan-event' &&
        candidate.schemaVersion === 1 &&
        typeof candidate.messageId === 'string' &&
        typeof candidate.sequence === 'number' &&
        typeof candidate.aggregate === 'string' &&
        typeof candidate.aggregateId === 'string' &&
        typeof candidate.type === 'string'
    );
}

export function toGatewayLanEvent(
    command: RawGatewayCommandLike,
    sequence: number
): GatewayLanEventMessage {
    return {
        schema: 'lole.gateway.lan-event',
        schemaVersion: 1,
        messageId: command.id ?? command.idempotencyKey ?? crypto.randomUUID(),
        sequence,
        restaurantId: command.restaurantId,
        locationId: command.locationId,
        aggregate: command.aggregate,
        aggregateId: command.aggregateId,
        type: command.type,
        idempotencyKey: command.idempotencyKey,
        emittedAt: new Date().toISOString(),
        payload: command.payload,
    };
}

export function getGatewayTopicsForScopes(args: {
    restaurantId: string;
    locationId: string;
    scopes: MqttScope[];
}): string[] {
    return args.scopes.map(scope =>
        buildRestaurantTopic({
            restaurantId: args.restaurantId,
            locationId: args.locationId,
            scope,
            channel: 'commands',
        })
    );
}
