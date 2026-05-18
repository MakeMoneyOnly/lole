import { Aedes, type Client as AedesClient } from 'aedes';
import { createServer, type Server as NetServer } from 'net';
import { createServer as createHttpServer, type Server as HttpServer } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { logger } from '@/lib/logger';
import { verifyGatewaySessionToken, type GatewaySessionClaims } from '@/lib/auth/gateway-session';
import {
    authorizePublish as aclAuthorizePublish,
    authorizeSubscribe as aclAuthorizeSubscribe,
} from '@/lib/gateway/broker-acl';

export interface BrokerMetrics {
    connectedClients: number;
    messagesPublished: number;
    messagesReceived: number;
    bytesPublished: number;
    bytesReceived: number;
    uptimeSeconds: number;
}

export interface BrokerInstance {
    broker: Aedes;
    tcpServer: NetServer | null;
    httpServer: HttpServer | null;
    wsServer: WebSocketServer | null;
    metrics: BrokerMetrics;
    start(): Promise<void>;
    stop(): Promise<void>;
}

interface AuthenticatedClient {
    client: AedesClient;
    claims: GatewaySessionClaims | null;
    connectedAt: string;
}

let connectedDevices: AuthenticatedClient[] = [];
let messagesPublished = 0;
let messagesReceived = 0;
let bytesPublished = 0;
let bytesReceived = 0;
let startTime: number | null = null;

function resetMetrics(): void {
    connectedDevices = [];
    messagesPublished = 0;
    messagesReceived = 0;
    bytesPublished = 0;
    bytesReceived = 0;
    startTime = Date.now();
}

function getMetrics(): BrokerMetrics {
    return {
        connectedClients: connectedDevices.length,
        messagesPublished,
        messagesReceived,
        bytesPublished,
        bytesReceived,
        uptimeSeconds: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
    };
}

function createBroker(): Aedes {
    const clientClaims = new Map<string, GatewaySessionClaims | null>();

    const broker = new Aedes({
        id: `gateway-${process.env.LOCATION_ID ?? 'unknown'}`,
        heartbeatInterval: 30_000,
        connectTimeout: 10_000,
    });

    broker.on('client', client => {
        logger.debug('[MQTT Broker] Client connected', { clientId: client?.id });
    });

    broker.on('clientDisconnect', client => {
        const idx = connectedDevices.findIndex(d => d.client === client);
        if (idx !== -1) {
            connectedDevices.splice(idx, 1);
        }
        if (client?.id) {
            clientClaims.delete(client.id);
        }
        logger.debug('[MQTT Broker] Client disconnected', {
            clientId: client?.id,
            remainingClients: connectedDevices.length,
        });
    });

    broker.on('clientError', (client, error) => {
        logger.warn('[MQTT Broker] Client error', {
            clientId: client?.id,
            errorMessage: error?.message,
        });
    });

    broker.on('connectionError', (client, error) => {
        logger.warn('[MQTT Broker] Connection error', {
            clientId: client?.id,
            errorMessage: error?.message,
        });
    });

    broker.authorizePublish = (client, packet, callback) => {
        const claims = client?.id ? (clientClaims.get(client.id) ?? null) : null;
        const decision = aclAuthorizePublish(packet.topic, claims);

        if (!decision.allowed) {
            logger.warn('[MQTT ACL] Publish denied', {
                topic: packet.topic,
                clientId: client?.id,
                reason: decision.reason,
            });
            callback(new Error(decision.reason));
            return;
        }

        callback(null);
    };

    broker.authorizeSubscribe = (client, subscription, callback) => {
        const claims = client?.id ? (clientClaims.get(client.id) ?? null) : null;
        const decision = aclAuthorizeSubscribe(subscription.topic, claims);

        if (!decision.allowed) {
            logger.warn('[MQTT ACL] Subscribe denied', {
                topic: subscription.topic,
                clientId: client?.id,
                reason: decision.reason,
            });
            callback(new Error(decision.reason), null);
            return;
        }

        callback(null, subscription);
    };

    broker.authenticate = (_client, username, password, callback) => {
        if (!username || !password) {
            logger.warn('[MQTT Auth] Rejected anonymous connection', {
                clientId: _client?.id,
                reason: 'Credentials required',
            });
            const err: Error & { returnCode: 4 | 5 } = new Error(
                'Authentication required'
            ) as Error & { returnCode: 4 | 5 };
            err.returnCode = 4;
            callback(err, false);
            return;
        }

        const pwStr = password.toString();
        const claims = verifyGatewaySessionToken(pwStr);
        if (claims) {
            clientClaims.set(_client.id, claims);
            logger.info('[MQTT Auth] Client authenticated', {
                clientId: _client.id,
                deviceId: claims.deviceId,
                restaurantId: claims.restaurantId,
            });
            callback(null, true);
            return;
        }

        logger.warn('[MQTT Auth] Authentication failed', {
            clientId: _client.id,
        });
        callback(null, false);
    };

    broker.on('publish', (packet, client) => {
        if (!client) return;

        messagesReceived++;
        if (packet.payload) {
            bytesReceived += Buffer.byteLength(packet.payload);
        }

        logger.debug('[MQTT Broker] Message published', {
            topic: packet.topic,
            clientId: client.id,
        });
    });

    broker.on('closed', () => {
        logger.info('[MQTT Broker] Closed');
    });

    return broker;
}

function createWebSocketStream(ws: WebSocket, req: IncomingMessage): import('stream').Duplex {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const aedesModule = require('aedes');
    return aedesModule.createWebSocketStream(ws, req);
}

function createWsTransport(broker: Aedes, httpServer: HttpServer): WebSocketServer {
    const wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const stream = createWebSocketStream(ws, req);
        broker.handle(stream);
    });

    wss.on('error', error => {
        logger.error('[MQTT Broker] WebSocket error', error);
    });

    return wss;
}

function createTcpTransport(broker: Aedes, port: number): NetServer {
    const server = createServer(socket => {
        broker.handle(socket);
    });

    server.on('error', error => {
        logger.error('[MQTT Broker] TCP server error', error);
    });

    server.listen(port);

    return server;
}

export function createGatewayBroker(
    host: string,
    wsPort: number,
    tcpPort?: number
): BrokerInstance {
    resetMetrics();

    const broker = createBroker();
    const httpServer = createHttpServer();
    let wsServer: WebSocketServer | null = null;
    let tcpServer: NetServer | null = null;

    const instance: BrokerInstance = {
        broker,
        tcpServer: null,
        httpServer: null,
        wsServer: null,

        get metrics() {
            return getMetrics();
        },

        async start() {
            return new Promise<void>((resolve, reject) => {
                httpServer.once('error', reject);

                httpServer.listen(wsPort, host, () => {
                    wsServer = createWsTransport(broker, httpServer);
                    instance.wsServer = wsServer;
                    instance.httpServer = httpServer;

                    if (tcpPort) {
                        tcpServer = createTcpTransport(broker, tcpPort);
                        instance.tcpServer = tcpServer;
                    }

                    logger.info('[MQTT Broker] Started', {
                        wsPort,
                        tcpPort: tcpPort ?? null,
                        host,
                    });

                    resolve();
                });
            });
        },

        async stop() {
            const closeWs = wsServer
                ? new Promise<void>(resolve => {
                      wsServer!.close(() => resolve());
                  })
                : Promise.resolve();

            const closeTcp = tcpServer
                ? new Promise<void>(resolve => {
                      tcpServer!.close(() => resolve());
                  })
                : Promise.resolve();

            const closeHttp = new Promise<void>(resolve => {
                httpServer.close(() => resolve());
            });

            const closeBroker = new Promise<void>(resolve => {
                broker.close(() => resolve());
            });

            await Promise.all([closeWs, closeTcp]);
            await closeHttp;
            await closeBroker;

            connectedDevices = [];
            wsServer = null;
            tcpServer = null;

            logger.info('[MQTT Broker] Stopped');
        },
    };

    return instance;
}

export { getMetrics, type AuthenticatedClient };
