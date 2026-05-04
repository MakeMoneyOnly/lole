import { createServer } from 'http';
import { mkdirSync, openSync, closeSync } from 'fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger } from '../logger';
import { getDeviceContext } from '../api/authz';
import { resolveGatewayIdentityVersion } from '../auth/offline-authz';
import { createGatewayBootstrapPayload } from './bootstrap';
import { DeviceProfileSchema, HardwareDeviceTypeSchema } from '../devices/config';
import { createGatewayBroker, type BrokerInstance } from './mqtt-broker';

interface StandaloneGatewayConfig {
    restaurantId: string;
    locationId: string;
    gatewayId: string;
    host: string;
    port: number;
    mqttBrokerUrl: string;
    dataDir: string;
    bootstrapSecret: string;
}

function getRequiredEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} is required`);
    }

    return value;
}

export function getStandaloneGatewayConfig(): StandaloneGatewayConfig {
    const host = process.env.GATEWAY_HOST ?? '127.0.0.1';
    const port = Number(process.env.GATEWAY_HEALTH_PORT ?? '8787');
    const dataDir = process.env.STORE_GATEWAY_DATA_DIR ?? join(process.cwd(), '.local-gateway');

    return {
        restaurantId: getRequiredEnv('RESTAURANT_ID'),
        locationId: getRequiredEnv('LOCATION_ID'),
        gatewayId: process.env.GATEWAY_ID ?? `gateway-${getRequiredEnv('LOCATION_ID')}`,
        host,
        port,
        mqttBrokerUrl: process.env.LAN_MQTT_URL ?? `ws://${host}:1884/mqtt`,
        dataDir,
        bootstrapSecret: getRequiredEnv('GATEWAY_BOOTSTRAP_SECRET'),
    };
}

export function initPersistentStorage(dataDir: string): string {
    mkdirSync(dataDir, { recursive: true });
    const journalPath = join(dataDir, 'local-journal.db');
    const handle = openSync(journalPath, 'a');
    closeSync(handle);
    return journalPath;
}

async function readBody(request: import('http').IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
}

export async function startStandaloneGatewayServer(
    config: StandaloneGatewayConfig = getStandaloneGatewayConfig()
): Promise<{ broker: BrokerInstance; close(): Promise<void> }> {
    const journalPath = initPersistentStorage(config.dataDir);

    const broker = createGatewayBroker(config.host, 1884);
    await broker.start();

    const server = createServer(async (request, response) => {
        const url = new URL(request.url ?? '/', `http://${config.host}:${config.port}`);

        if (url.pathname === '/health') {
            const brokerMetrics = broker.metrics;
            const payload = JSON.stringify({
                health: {
                    gatewayId: config.gatewayId,
                    restaurantId: config.restaurantId,
                    locationId: config.locationId,
                    operatingMode: 'offline-local',
                    lanTransport: 'mqtt',
                    fiscalContinuityMode: 'local-signing',
                    queueDurabilityMode: 'persistent-local-queue',
                    timestamp: new Date().toISOString(),
                    journalPath,
                    broker: {
                        connectedClients: brokerMetrics.connectedClients,
                        messagesPublished: brokerMetrics.messagesPublished,
                        messagesReceived: brokerMetrics.messagesReceived,
                        uptimeSeconds: brokerMetrics.uptimeSeconds,
                    },
                },
            });

            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(payload);
            return;
        }

        if (url.pathname === '/metrics') {
            const mqttBrokerConnected = broker.broker.closed ? 0 : 1;
            const metricsPayload = [
                '# HELP gateway_uptime_seconds Time since gateway started',
                '# TYPE gateway_uptime_seconds gauge',
                `gateway_uptime_seconds ${broker.metrics.uptimeSeconds}`,
                '# HELP gateway_mqtt_connections_total Current connected MQTT clients',
                '# TYPE gateway_mqtt_connections_total gauge',
                `gateway_mqtt_connections_total ${broker.metrics.connectedClients}`,
                '# HELP gateway_mqtt_messages_published_total MQTT messages published',
                '# TYPE gateway_mqtt_messages_published_total counter',
                `gateway_mqtt_messages_published_total ${broker.metrics.messagesPublished}`,
                '# HELP gateway_mqtt_messages_received_total MQTT messages received',
                '# TYPE gateway_mqtt_messages_received_total counter',
                `gateway_mqtt_messages_received_total ${broker.metrics.messagesReceived}`,
                '# HELP gateway_health_status 1 if healthy',
                '# TYPE gateway_health_status gauge',
                `gateway_health_status ${mqttBrokerConnected}`,
                '',
            ].join('\n');

            response.writeHead(200, { 'content-type': 'text/plain' });
            response.end(metricsPayload);
            return;
        }

        if (url.pathname === '/bootstrap' && request.method === 'POST') {
            const body = await readBody(request);
            const parsed = body ? (JSON.parse(body) as Record<string, unknown>) : {};
            let payload: ReturnType<typeof createGatewayBootstrapPayload> | null = null;

            if (request.headers['x-device-token']) {
                const authRequest = new Request(url, {
                    method: request.method,
                    headers: Object.entries(request.headers).reduce(
                        (acc, [key, value]) => {
                            if (typeof value === 'string') acc[key] = value;
                            if (Array.isArray(value)) acc[key] = value.join(', ');
                            return acc;
                        },
                        {} as Record<string, string>
                    ),
                    body: body.length > 0 ? body : undefined,
                });
                const context = await getDeviceContext(authRequest);
                if (!context.ok) {
                    response.writeHead(401, { 'content-type': 'application/json' });
                    response.end(JSON.stringify({ error: 'Unauthorized bootstrap request' }));
                    return;
                }
                const deviceType = HardwareDeviceTypeSchema.safeParse(context.device.device_type)
                    .success
                    ? (context.device.device_type as
                          | 'pos'
                          | 'kds'
                          | 'kiosk'
                          | 'digital_menu'
                          | 'terminal')
                    : 'pos';
                const deviceProfile = DeviceProfileSchema.safeParse(context.device.device_profile)
                    .success
                    ? context.device.device_profile
                    : null;

                payload = createGatewayBootstrapPayload({
                    deviceId: context.device.id,
                    restaurantId: context.restaurantId,
                    locationId: context.device.location_id ?? config.locationId,
                    gatewayId: config.gatewayId,
                    gatewayHost: config.host,
                    mqttBrokerUrl: config.mqttBrokerUrl,
                    healthPort: config.port,
                    deviceType,
                    deviceProfile,
                    identityVersion: resolveGatewayIdentityVersion(context.device.metadata),
                    operatingMode: 'offline-local',
                });
            } else if (
                process.env.NODE_ENV !== 'production' &&
                request.headers['x-gateway-bootstrap-secret'] === config.bootstrapSecret
            ) {
                logger.warn(
                    '[Gateway] Bootstrap via static secret used — only allowed in non-production'
                );
                const deviceId =
                    typeof parsed.deviceId === 'string' && parsed.deviceId.length > 0
                        ? parsed.deviceId
                        : 'bootstrap-device';
                const locationId =
                    typeof parsed.locationId === 'string' && parsed.locationId.length > 0
                        ? parsed.locationId
                        : config.locationId;
                payload = createGatewayBootstrapPayload({
                    deviceId,
                    restaurantId: config.restaurantId,
                    locationId,
                    gatewayId: config.gatewayId,
                    gatewayHost: config.host,
                    mqttBrokerUrl: config.mqttBrokerUrl,
                    healthPort: config.port,
                    operatingMode: 'offline-local',
                });
            }

            if (!payload) {
                response.writeHead(401, { 'content-type': 'application/json' });
                response.end(JSON.stringify({ error: 'Unauthorized bootstrap request' }));
                return;
            }

            response.writeHead(200, { 'content-type': 'application/json' });
            response.end(JSON.stringify(payload));
            return;
        }

        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'Not found' }));
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, () => resolve());
    });

    logger.info('[Gateway] Standalone gateway started', {
        gatewayId: config.gatewayId,
        host: config.host,
        port: config.port,
        brokerPort: 1884,
        journalPath,
    });

    return {
        broker,
        close: async () => {
            await new Promise<void>((resolve, reject) => {
                server.close(error => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            await broker.stop();
        },
    };
}

const executedPath = process.argv[1];
const isDirectRun =
    executedPath !== undefined && import.meta.url === pathToFileURL(executedPath).href;

if (isDirectRun) {
    void startStandaloneGatewayServer()
        .then(({ broker, close }) => {
            const shutdown = async () => {
                logger.info('[Gateway] Shutting down...');
                await close();
                process.exit(0);
            };
            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
        })
        .catch(error => {
            logger.error('[Gateway] Failed to start standalone gateway', error);
            process.exitCode = 1;
        });
}
