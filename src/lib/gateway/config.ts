import { logger } from '@/lib/logger';

export type StoreOperatingMode = 'online' | 'degraded' | 'offline-local' | 'reconciling';
export type StoreGatewayRuntime = 'node-service';
export type StoreGatewayHostTarget = 'mini-pc' | 'android-edge-box' | 'embedded-linux';
export type LanTransportKind = 'mqtt';
export type FiscalContinuityMode = 'local-signing';
export type QueueDurabilityMode = 'persistent-local-queue';

export interface StoreGatewayConfig {
    restaurantId: string;
    locationId: string;
    gatewayId: string;
    runtime: StoreGatewayRuntime;
    hostTarget: StoreGatewayHostTarget;
    lanTransport: LanTransportKind;
    mqttBrokerUrl: string;
    fiscalContinuityMode: FiscalContinuityMode;
    queueDurabilityMode: QueueDurabilityMode;
    healthPort: number;
    defaultOperatingMode: StoreOperatingMode;
}

function parseHealthPort(value: string | undefined): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 8787;
    }

    return parsed;
}

export function getStoreGatewayConfig(): StoreGatewayConfig | null {
    const restaurantId = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? process.env.RESTAURANT_ID;
    const locationId = process.env.NEXT_PUBLIC_LOCATION_ID ?? process.env.LOCATION_ID;

    if (!restaurantId || !locationId) {
        logger.warn('[Gateway] Missing restaurant/location scope for gateway config');
        return null;
    }

    return {
        restaurantId,
        locationId,
        gatewayId:
            process.env.NEXT_PUBLIC_GATEWAY_ID ??
            process.env.GATEWAY_ID ??
            `gateway-${locationId.toLowerCase()}`,
        runtime: 'node-service',
        hostTarget:
            process.env.GATEWAY_HOST_TARGET === 'embedded-linux'
                ? 'embedded-linux'
                : process.env.GATEWAY_HOST_TARGET === 'android-edge-box'
                  ? 'android-edge-box'
                  : 'mini-pc',
        lanTransport: 'mqtt',
        mqttBrokerUrl:
            process.env.NEXT_PUBLIC_LAN_MQTT_URL ??
            process.env.LAN_MQTT_URL ??
            'ws://127.0.0.1:1884/mqtt',
        fiscalContinuityMode: 'local-signing',
        queueDurabilityMode: 'persistent-local-queue',
        healthPort: parseHealthPort(process.env.GATEWAY_HEALTH_PORT),
        defaultOperatingMode: 'offline-local',
    };
}

export interface GatewayHealthSnapshot {
    gatewayId: string;
    restaurantId: string;
    locationId: string;
    operatingMode: StoreOperatingMode;
    lanTransport: LanTransportKind;
    fiscalContinuityMode: FiscalContinuityMode;
    queueDurabilityMode: QueueDurabilityMode;
    timestamp: string;
}

export function buildGatewayHealthSnapshot(
    config: StoreGatewayConfig,
    operatingMode: StoreOperatingMode
): GatewayHealthSnapshot {
    return {
        gatewayId: config.gatewayId,
        restaurantId: config.restaurantId,
        locationId: config.locationId,
        operatingMode,
        lanTransport: config.lanTransport,
        fiscalContinuityMode: config.fiscalContinuityMode,
        queueDurabilityMode: config.queueDurabilityMode,
        timestamp: new Date().toISOString(),
    };
}
