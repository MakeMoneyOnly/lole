import { logger } from '@/lib/logger';
import {
    closeLanMqttClient,
    createLanMqttClient,
    publishJson,
    registerLanMessageHandler,
    subscribeTopic,
    type MqttTransportConfig,
} from '@/lib/lan/mqtt-client';
import {
    buildGatewayDiscoveryTopic,
    buildGatewayModeTopic,
    buildRestaurantTopic,
    type MqttScope,
} from '@/lib/lan/mqtt-topics';
import { toGatewayLanEvent } from '@/lib/gateway/local-events';
import { buildGatewayDiscoveryRecord } from '@/lib/lan/discovery';
import {
    buildGatewayHealthSnapshot,
    getStoreGatewayConfig,
    type GatewayHealthSnapshot,
    type StoreGatewayConfig,
    type StoreOperatingMode,
} from '@/lib/gateway/config';
import { GatewayError, GatewayErrorCode } from '@/lib/gateway/errors';
import type { MqttClient } from 'mqtt';

export interface GatewayCommandMessage {
    type: string;
    aggregate: string;
    aggregateId: string;
    payload: Record<string, unknown>;
    restaurantId: string;
    locationId: string;
}

type GatewayHandler = (message: GatewayCommandMessage) => Promise<void> | void;

function buildTransportConfig(config: StoreGatewayConfig): MqttTransportConfig {
    return {
        brokerUrl: config.mqttBrokerUrl,
        clientId: config.gatewayId,
        clean: false,
    };
}

function resolveScopeForCommand(type: string): MqttScope {
    if (type.startsWith('order.')) return 'orders';
    if (type.startsWith('kds.')) return 'kds';
    if (type.startsWith('table.')) return 'tables';
    if (type.startsWith('printer.')) return 'printers';
    if (type.startsWith('fiscal.')) return 'fiscal';
    return 'system';
}

export interface DeviceConnectionRecord {
    deviceId: string;
    connectedAt: string;
    lastHeartbeatAt: string;
    status: 'connected' | 'disconnected';
}

export class StoreGatewayService {
    private readonly config: StoreGatewayConfig;
    private client: MqttClient | null = null;
    private readonly handlers = new Map<string, GatewayHandler>();
    private currentMode: StoreOperatingMode;
    private readonly sequenceByAggregate = new Map<string, number>();
    private readonly maxRetries: number;
    private readonly retryBaseMs: number;
    private readonly connectedDevices = new Map<string, DeviceConnectionRecord>();

    constructor(
        config?: StoreGatewayConfig | null,
        retryOptions?: {
            maxRetries?: number;
            retryBaseMs?: number;
        }
    ) {
        const resolvedConfig = config ?? getStoreGatewayConfig();
        if (!resolvedConfig) {
            throw new GatewayError(GatewayErrorCode.INVALID_CONFIG, 'Store gateway config missing');
        }

        this.config = resolvedConfig;
        this.currentMode = resolvedConfig.defaultOperatingMode;
        this.maxRetries = retryOptions?.maxRetries ?? 3;
        this.retryBaseMs = retryOptions?.retryBaseMs ?? 100;
    }

    async start(): Promise<void> {
        if (this.client) {
            return;
        }

        this.client = createLanMqttClient(buildTransportConfig(this.config));
        const topics = [
            buildRestaurantTopic({
                restaurantId: this.config.restaurantId,
                locationId: this.config.locationId,
                scope: 'orders',
                channel: 'commands',
            }),
            buildRestaurantTopic({
                restaurantId: this.config.restaurantId,
                locationId: this.config.locationId,
                scope: 'kds',
                channel: 'commands',
            }),
            buildRestaurantTopic({
                restaurantId: this.config.restaurantId,
                locationId: this.config.locationId,
                scope: 'tables',
                channel: 'commands',
            }),
            buildRestaurantTopic({
                restaurantId: this.config.restaurantId,
                locationId: this.config.locationId,
                scope: 'printers',
                channel: 'jobs',
            }),
            buildRestaurantTopic({
                restaurantId: this.config.restaurantId,
                locationId: this.config.locationId,
                scope: 'fiscal',
                channel: 'jobs',
            }),
        ];

        for (const topic of topics) {
            await subscribeTopic(this.client, topic, 1);
        }

        registerLanMessageHandler(this.client, (_topic, raw) => {
            try {
                logger.debug('[Gateway] Raw message received', { topic: _topic });

                const parsed = JSON.parse(String(raw)) as
                    | GatewayCommandMessage
                    | { type: string; payload: Record<string, unknown> };
                const commandLike =
                    'schema' in (parsed as Record<string, unknown>)
                        ? (parsed as { type: string; payload: Record<string, unknown> })
                        : (parsed as GatewayCommandMessage);

                logger.debug('[Gateway] Parsed command', {
                    type: commandLike.type,
                    aggregate: (commandLike as GatewayCommandMessage).aggregate,
                });

                const handler = this.handlers.get(commandLike.type);
                if (handler) {
                    logger.debug('[Gateway] Routing command to handler', {
                        type: commandLike.type,
                    });
                    void handler(commandLike as GatewayCommandMessage);
                } else {
                    logger.debug('[Gateway] No handler registered for command', {
                        type: commandLike.type,
                    });
                }
            } catch (error) {
                logger.error('[Gateway] Failed to process command message', error);
            }
        });

        await this.publishMode(this.currentMode);
        await this.publishDiscovery();
    }

    registerHandler(type: string, handler: GatewayHandler): void {
        this.handlers.set(type, handler);
    }

    async publishCommand(message: GatewayCommandMessage): Promise<void> {
        if (!this.client) {
            await this.start();
        }

        if (!this.client) {
            throw new GatewayError(
                GatewayErrorCode.BROKER_UNAVAILABLE,
                'Gateway MQTT client unavailable',
                { aggregate: message.aggregate, type: message.type }
            );
        }

        const aggregateKey = `${message.aggregate}:${message.aggregateId}`;
        const nextSequence = (this.sequenceByAggregate.get(aggregateKey) ?? 0) + 1;
        this.sequenceByAggregate.set(aggregateKey, nextSequence);

        const topic = buildRestaurantTopic({
            restaurantId: message.restaurantId,
            locationId: message.locationId,
            scope: resolveScopeForCommand(message.type),
            channel:
                message.type.startsWith('printer.') || message.type.startsWith('fiscal.')
                    ? 'jobs'
                    : 'commands',
        });

        const event = toGatewayLanEvent(message, nextSequence);
        let lastError: unknown;

        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                await publishJson(this.client, topic, event, { qos: 1 });
                return;
            } catch (err) {
                lastError = err;
                if (attempt < this.maxRetries) {
                    const delay = this.retryBaseMs * Math.pow(2, attempt);
                    logger.warn(
                        `[Gateway] Publish attempt ${attempt + 1} failed, retrying in ${delay}ms`,
                        { type: message.type }
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw new GatewayError(
            GatewayErrorCode.COMMAND_DISPATCH_FAILED,
            `Failed to publish command after ${this.maxRetries + 1} attempts`,
            { type: message.type, error: String(lastError) }
        );
    }

    async publishMode(mode: StoreOperatingMode): Promise<void> {
        this.currentMode = mode;

        if (!this.client) {
            return;
        }

        await publishJson(
            this.client,
            buildGatewayModeTopic(this.config.restaurantId, this.config.locationId),
            buildGatewayHealthSnapshot(this.config, mode),
            { qos: 0, retain: true }
        );
    }

    async publishDiscovery(): Promise<void> {
        if (!this.client) {
            return;
        }

        await publishJson(
            this.client,
            buildGatewayDiscoveryTopic(this.config.restaurantId, this.config.locationId),
            buildGatewayDiscoveryRecord(this.config),
            { qos: 0, retain: true }
        );
    }

    getHealth(): GatewayHealthSnapshot {
        return buildGatewayHealthSnapshot(this.config, this.currentMode);
    }

    onDeviceConnected(deviceId: string): void {
        const now = new Date().toISOString();
        this.connectedDevices.set(deviceId, {
            deviceId,
            connectedAt: now,
            lastHeartbeatAt: now,
            status: 'connected',
        });
        logger.info('[Gateway] Device connected', {
            deviceId,
            totalDevices: this.connectedDevices.size,
        });
    }

    onDeviceDisconnected(deviceId: string): void {
        this.connectedDevices.delete(deviceId);
        logger.info('[Gateway] Device disconnected', {
            deviceId,
            totalDevices: this.connectedDevices.size,
        });
    }

    getConnectedDeviceIds(): string[] {
        return [...this.connectedDevices.keys()];
    }

    getConnectedDeviceCount(): number {
        return this.connectedDevices.size;
    }

    async stop(): Promise<void> {
        if (!this.client) {
            return;
        }

        await closeLanMqttClient(this.client);
        this.client = null;
        this.connectedDevices.clear();
    }
}

export function createStoreGatewayService(
    config?: StoreGatewayConfig | null,
    options?: { maxRetries?: number; retryBaseMs?: number }
): StoreGatewayService {
    return new StoreGatewayService(config, options);
}

let gatewayService: StoreGatewayService | null = null;

export function getStoreGatewayService(): StoreGatewayService | null {
    if (gatewayService) {
        return gatewayService;
    }

    const config = getStoreGatewayConfig();
    if (!config) {
        return null;
    }

    gatewayService = createStoreGatewayService(config);
    return gatewayService;
}
