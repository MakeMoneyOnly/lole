import mqtt, {
    type IClientOptions,
    type IClientPublishOptions,
    type ISubscriptionGrant,
    type MqttClient,
} from 'mqtt';
import { logger } from '@/lib/logger';

export type MqttQosLevel = 0 | 1 | 2;

export interface MqttTransportConfig {
    brokerUrl: string;
    clientId: string;
    username?: string;
    password?: string;
    keepaliveSeconds?: number;
    reconnectPeriodMs?: number;
    connectTimeoutMs?: number;
    clean?: boolean;
}

export interface PublishJsonOptions {
    qos?: MqttQosLevel;
    retain?: boolean;
}

export type LanMessageHandler = (topic: string, payload: Buffer) => void;

export function createLanMqttClient(config: MqttTransportConfig): MqttClient {
    const uniqueClientId = `${config.clientId}-${Math.random().toString(36).substring(2, 8)}`;
    const options: IClientOptions = {
        clientId: uniqueClientId,
        username: config.username,
        password: config.password,
        keepalive: config.keepaliveSeconds ?? 30,
        reconnectPeriod: config.reconnectPeriodMs ?? 2000,
        connectTimeout: config.connectTimeoutMs ?? 5000,
        clean: config.clean ?? false,
    };

    const client = mqtt.connect(config.brokerUrl, options);

    client.on('connect', () => {
        logger.info('[LAN/MQTT] Connected', {
            brokerUrl: config.brokerUrl,
            clientId: config.clientId,
        });
    });

    client.on('reconnect', () => {
        logger.warn('[LAN/MQTT] Reconnecting', { clientId: config.clientId });
    });

    client.on('error', error => {
        logger.error('[LAN/MQTT] Client error', error, { clientId: config.clientId });
    });

    return client;
}

export async function publishJson(
    client: MqttClient,
    topic: string,
    payload: unknown,
    options?: PublishJsonOptions
): Promise<void> {
    const publishOptions: IClientPublishOptions = {
        qos: options?.qos ?? 1,
        retain: options?.retain ?? false,
    };

    await new Promise<void>((resolve, reject) => {
        client.publish(topic, JSON.stringify(payload), publishOptions, error => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

export function registerLanMessageHandler(client: MqttClient, handler: LanMessageHandler): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).on('message', handler);
}

export async function subscribeTopic(
    client: MqttClient,
    topic: string,
    qos: MqttQosLevel = 1
): Promise<ISubscriptionGrant[]> {
    return await new Promise<ISubscriptionGrant[]>((resolve, reject) => {
        client.subscribe(topic, { qos }, (error, granted) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(granted);
        });
    });
}

export async function closeLanMqttClient(client: MqttClient): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        client.end(false, {}, error => {
            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}
