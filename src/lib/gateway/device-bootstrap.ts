import {
    closeLanMqttClient,
    createLanMqttClient,
    type MqttTransportConfig,
} from '@/lib/lan/mqtt-client';
import { observeGatewayDiscoveryTopic } from '@/lib/lan/discovery-client';
import type { GatewayDiscoveryRecord } from '@/lib/lan/discovery';
import type { StoreOperatingMode } from '@/lib/gateway/config';

export interface DeviceGatewayBootstrapSession {
    gatewayId: string;
    brokerUrl: string;
    bootstrapUrl: string;
    healthUrl: string;
    operatingMode: StoreOperatingMode;
    sessionToken: string;
    topicPrefix: string;
    issuedAt: string;
    expiresAt: string;
}

export interface BootstrapGatewayForPairedDeviceInput {
    deviceToken: string;
    restaurantId: string;
    locationId: string;
    preferredBrokerUrl?: string | null;
    fallbackBootstrapUrl?: string | null;
    discoveryTimeoutMs?: number;
}

interface BootstrapResponsePayload {
    discovery: GatewayDiscoveryRecord;
    health: {
        operatingMode: StoreOperatingMode;
    };
    session: {
        token: string;
        claims: {
            topicPrefix: string;
            issuedAt: string;
            expiresAt: string;
        };
    };
}

function buildBootstrapTransportConfig(brokerUrl: string): MqttTransportConfig {
    return {
        brokerUrl,
        clientId: `gateway-bootstrap-${crypto.randomUUID()}`,
        clean: true,
        reconnectPeriodMs: 0,
        connectTimeoutMs: 2000,
    };
}

function deriveGatewayBaseUrl(record: GatewayDiscoveryRecord): string {
    const brokerUrl = new URL(record.brokerUrl);
    const protocol = brokerUrl.protocol === 'wss:' ? 'https:' : 'http:';
    return `${protocol}//${brokerUrl.hostname}:${record.healthPort}`;
}

async function discoverGatewayRecord(
    restaurantId: string,
    locationId: string,
    brokerUrl: string,
    timeoutMs: number
): Promise<GatewayDiscoveryRecord | null> {
    const client = createLanMqttClient(buildBootstrapTransportConfig(brokerUrl));

    try {
        return await new Promise<GatewayDiscoveryRecord | null>(async resolve => {
            const timer = globalThis.setTimeout(() => resolve(null), timeoutMs);

            await observeGatewayDiscoveryTopic(client, restaurantId, locationId, record => {
                globalThis.clearTimeout(timer);
                resolve(record);
            });
        });
    } finally {
        await closeLanMqttClient(client).catch(() => undefined);
    }
}

async function exchangeForGatewaySession(
    bootstrapUrl: string,
    deviceToken: string
): Promise<BootstrapResponsePayload | null> {
    const response = await fetch(bootstrapUrl, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-device-token': deviceToken,
        },
        body: JSON.stringify({}),
    });

    if (!response.ok) {
        return null;
    }

    return (await response.json()) as BootstrapResponsePayload;
}

export async function bootstrapGatewayForPairedDevice(
    input: BootstrapGatewayForPairedDeviceInput
): Promise<DeviceGatewayBootstrapSession | null> {
    let bootstrapUrl = input.fallbackBootstrapUrl ?? null;

    if (input.preferredBrokerUrl) {
        const record = await discoverGatewayRecord(
            input.restaurantId,
            input.locationId,
            input.preferredBrokerUrl,
            input.discoveryTimeoutMs ?? 1500
        );

        if (record) {
            bootstrapUrl = `${deriveGatewayBaseUrl(record)}/bootstrap`;
        }
    }

    if (!bootstrapUrl) {
        return null;
    }

    const payload = await exchangeForGatewaySession(bootstrapUrl, input.deviceToken);
    if (!payload) {
        return null;
    }

    return {
        gatewayId: payload.discovery.gatewayId,
        brokerUrl: payload.discovery.brokerUrl,
        bootstrapUrl,
        healthUrl: bootstrapUrl.replace(/\/bootstrap$/, '/health'),
        operatingMode: payload.health.operatingMode,
        sessionToken: payload.session.token,
        topicPrefix: payload.session.claims.topicPrefix,
        issuedAt: payload.session.claims.issuedAt,
        expiresAt: payload.session.claims.expiresAt,
    };
}
