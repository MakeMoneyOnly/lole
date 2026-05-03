import type { MqttClient } from 'mqtt';
import { parseGatewayDiscoveryRecord, type GatewayDiscoveryRecord } from '@/lib/lan/discovery';
import { buildGatewayDiscoveryTopic } from '@/lib/lan/mqtt-topics';
import { registerLanMessageHandler } from '@/lib/lan/mqtt-client';

export function selectPreferredGatewayDiscoveryRecord(
    records: GatewayDiscoveryRecord[]
): GatewayDiscoveryRecord | null {
    if (records.length === 0) {
        return null;
    }

    return [...records].sort((left, right) => {
        return new Date(right.advertisedAt).getTime() - new Date(left.advertisedAt).getTime();
    })[0];
}

export async function observeGatewayDiscoveryTopic(
    client: MqttClient,
    restaurantId: string,
    locationId: string,
    onRecord: (record: GatewayDiscoveryRecord) => void
): Promise<void> {
    const topic = buildGatewayDiscoveryTopic(restaurantId, locationId);

    await new Promise<void>((resolve, reject) => {
        client.subscribe(topic, { qos: 0 }, error => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });

    registerLanMessageHandler(client, (messageTopic, rawPayload) => {
        if (messageTopic !== topic) {
            return;
        }

        const result = parseGatewayDiscoveryRecord(String(rawPayload));
        if (!result.ok || !result.value) {
            return;
        }

        onRecord(result.value);
    });
}
