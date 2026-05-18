import type { StoreGatewayConfig } from '@/lib/gateway/config';

export interface GatewayDiscoveryRecord {
    gatewayId: string;
    restaurantId: string;
    locationId: string;
    brokerUrl: string;
    healthPort: number;
    transport: 'mqtt';
    capabilities: Array<'orders' | 'kds' | 'tables' | 'printers' | 'fiscal'>;
    advertisedAt: string;
}

export function buildGatewayDiscoveryRecord(config: StoreGatewayConfig): GatewayDiscoveryRecord {
    return {
        gatewayId: config.gatewayId,
        restaurantId: config.restaurantId,
        locationId: config.locationId,
        brokerUrl: config.mqttBrokerUrl,
        healthPort: config.healthPort,
        transport: 'mqtt',
        capabilities: ['orders', 'kds', 'tables', 'printers', 'fiscal'],
        advertisedAt: new Date().toISOString(),
    };
}

export function serializeGatewayDiscoveryRecord(record: GatewayDiscoveryRecord): string {
    return JSON.stringify(record);
}

export interface ParseResult<T> {
    ok: boolean;
    value?: T;
    reason?: 'parse_error' | 'invalid_shape';
}

export function parseGatewayDiscoveryRecord(raw: string): ParseResult<GatewayDiscoveryRecord> {
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { ok: false, reason: 'parse_error' };
    }

    if (!parsed || typeof parsed !== 'object') {
        return { ok: false, reason: 'invalid_shape' };
    }

    const record = parsed as Record<string, unknown>;
    if (
        typeof record.gatewayId !== 'string' ||
        typeof record.restaurantId !== 'string' ||
        typeof record.locationId !== 'string' ||
        typeof record.brokerUrl !== 'string' ||
        typeof record.healthPort !== 'number'
    ) {
        return { ok: false, reason: 'invalid_shape' };
    }

    return { ok: true, value: record as unknown as GatewayDiscoveryRecord };
}
