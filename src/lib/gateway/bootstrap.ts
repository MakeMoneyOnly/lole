import type { GatewaySessionBundle } from '@/lib/auth/gateway-session';
import {
    buildOfflineDeviceAuthorization,
    buildOfflineStaffOutagePolicy,
} from '@/lib/auth/offline-authz';
import { buildGatewayDiscoveryRecord, type GatewayDiscoveryRecord } from '@/lib/lan/discovery';
import {
    buildGatewayHealthSnapshot,
    type GatewayHealthSnapshot,
    type StoreGatewayConfig,
} from '@/lib/gateway/config';
import type { DeviceProfile, HardwareDeviceType } from '@/lib/devices/config';

export interface GatewayBootstrapPayload {
    discovery: GatewayDiscoveryRecord;
    health: GatewayHealthSnapshot;
    session: GatewaySessionBundle;
    endpoints: {
        health: string;
        bootstrap: string;
    };
}

export interface CreateGatewayBootstrapPayloadInput {
    deviceId: string;
    restaurantId: string;
    locationId: string;
    gatewayId: string;
    gatewayHost: string;
    mqttBrokerUrl: string;
    healthPort: number;
    deviceType?: HardwareDeviceType;
    deviceProfile?: DeviceProfile | null;
    identityVersion?: number;
    operatingMode?: GatewayHealthSnapshot['operatingMode'];
}

function buildBootstrapConfig(input: CreateGatewayBootstrapPayloadInput): StoreGatewayConfig {
    return {
        restaurantId: input.restaurantId,
        locationId: input.locationId,
        gatewayId: input.gatewayId,
        runtime: 'node-service',
        hostTarget: 'mini-pc',
        lanTransport: 'mqtt',
        mqttBrokerUrl: input.mqttBrokerUrl,
        fiscalContinuityMode: 'local-signing',
        queueDurabilityMode: 'persistent-local-queue',
        healthPort: input.healthPort,
        defaultOperatingMode: input.operatingMode ?? 'offline-local',
    };
}

export function createGatewayBootstrapPayload(input: CreateGatewayBootstrapPayloadInput): Omit<
    GatewayBootstrapPayload,
    'session'
> & {
    session: {
        deviceId: string;
        restaurantId: string;
        locationId: string;
        gatewayId: string;
        deviceType: HardwareDeviceType;
        deviceProfile: DeviceProfile | null;
        identityVersion: number;
        authorizations: unknown[];
        offlineAccessExpiresAt: string;
        staffOutagePolicy: Record<string, unknown>;
    };
} {
    const config = buildBootstrapConfig(input);
    const health = buildGatewayHealthSnapshot(
        config,
        input.operatingMode ?? config.defaultOperatingMode
    );

    const offlineAuthorization = buildOfflineDeviceAuthorization({
        deviceType: input.deviceType ?? 'pos',
        deviceProfile: input.deviceProfile ?? null,
    });
    const staffOutagePolicy = buildOfflineStaffOutagePolicy({
        deviceType: input.deviceType ?? 'pos',
        deviceProfile: input.deviceProfile ?? null,
    });
    const issuedAt = new Date();
    const offlineAccessExpiresAt = new Date(
        issuedAt.getTime() + offlineAuthorization.ttlMinutes * 60 * 1000
    ).toISOString();

    return {
        discovery: buildGatewayDiscoveryRecord(config),
        health,
        session: {
            deviceId: input.deviceId,
            restaurantId: input.restaurantId,
            locationId: input.locationId,
            gatewayId: input.gatewayId,
            deviceType: input.deviceType ?? 'pos',
            deviceProfile: input.deviceProfile ?? null,
            identityVersion: input.identityVersion ?? 1,
            authorizations: offlineAuthorization.capabilities,
            offlineAccessExpiresAt,
            staffOutagePolicy: {
                ...staffOutagePolicy,
                issuedAt: issuedAt.toISOString(),
            },
        },
        endpoints: {
            health: `http://${input.gatewayHost}:${input.healthPort}/health`,
            bootstrap: `http://${input.gatewayHost}:${input.healthPort}/bootstrap`,
        },
    };
}
