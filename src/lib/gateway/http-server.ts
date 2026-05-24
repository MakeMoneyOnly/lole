import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import { getDeviceContext } from '@/lib/api/authz';
import { resolveGatewayIdentityVersion } from '@/lib/auth/offline-authz';
import { createGatewayBootstrapPayload } from '@/lib/gateway/bootstrap';
import type { GatewayHealthSnapshot } from '@/lib/gateway/config';
import { HardwareDeviceTypeSchema, DeviceProfileSchema } from '@/lib/devices/config';

export interface GatewayHttpServerInstance {
    baseUrl: string;
    port: number;
    close: () => Promise<void>;
}

export interface GatewayHttpServerOptions {
    port: number;
    gatewayHost: string;
    mqttBrokerUrl?: string;
    getHealth: () => GatewayHealthSnapshot;
    bootstrapDevice?: (deviceId: string) => void | Promise<void>;
}

function sendJson(
    response: ServerResponse,
    statusCode: number,
    body: Record<string, unknown>
): void {
    const payload = JSON.stringify(body);
    response.writeHead(statusCode, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
    });
    response.end(payload);
}

async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];

    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString('utf8');
}

async function proxyResponse(source: Response, target: ServerResponse): Promise<void> {
    const text = await source.text();
    target.writeHead(source.status, {
        'content-type': source.headers.get('content-type') ?? 'application/json',
    });
    target.end(text);
}

async function handleBootstrapRequest(
    request: IncomingMessage,
    response: ServerResponse,
    options: GatewayHttpServerOptions
): Promise<void> {
    const url = new URL(
        request.url ?? '/bootstrap',
        `http://${request.headers.host ?? '127.0.0.1'}`
    );
    const body = await readBody(request);
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
        await proxyResponse(context.response, response);
        return;
    }

    const health = options.getHealth();
    const deviceType = HardwareDeviceTypeSchema.safeParse(context.device.device_type).success
        ? (context.device.device_type as 'pos' | 'kds' | 'kiosk' | 'digital_menu' | 'terminal')
        : 'pos';
    const deviceProfile = DeviceProfileSchema.safeParse(context.device.device_profile).success
        ? context.device.device_profile
        : null;
    const payload = createGatewayBootstrapPayload({
        deviceId: context.device.id,
        restaurantId: context.restaurantId,
        locationId: context.device.location_id ?? health.locationId,
        gatewayId: health.gatewayId,
        gatewayHost: options.gatewayHost,
        mqttBrokerUrl:
            options.mqttBrokerUrl ??
            `ws://${options.gatewayHost}:${health.gatewayId ? 1884 : 1884}/mqtt`,
        healthPort: health.timestamp
            ? Number(
                  new URL(`http://${options.gatewayHost}:${url.port || '80'}`).port ||
                      health.gatewayId
              )
            : 0,
        deviceType,
        deviceProfile,
        identityVersion: resolveGatewayIdentityVersion(context.device.metadata),
        operatingMode: health.operatingMode,
    });

    await options.bootstrapDevice?.(context.device.id);
    sendJson(response, 200, payload as unknown as Record<string, unknown>);
}

function createRequestListener(
    options: GatewayHttpServerOptions
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
    return async (request, response) => {
        const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);

        if (url.pathname === '/health') {
            if (request.method === 'HEAD') {
                response.writeHead(200);
                response.end();
                return;
            }

            sendJson(response, 200, { health: options.getHealth() });
            return;
        }

        if (url.pathname === '/bootstrap' && request.method === 'POST') {
            await handleBootstrapRequest(request, response, options);
            return;
        }

        sendJson(response, 404, {
            error: 'Not found',
        });
    };
}

async function listen(server: Server, requestedPort: number): Promise<number> {
    return await new Promise<number>((resolve, reject) => {
        server.once('error', reject);
        server.listen(requestedPort, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('Gateway server failed to bind to a TCP port'));
                return;
            }

            resolve(address.port);
        });
    });
}

export async function createGatewayHttpServer(
    options: GatewayHttpServerOptions
): Promise<GatewayHttpServerInstance> {
    const server = createServer((request, response) => {
        void createRequestListener(options)(request, response);
    });
    const port = await listen(server, options.port);

    return {
        port,
        baseUrl: `http://127.0.0.1:${port}`,
        close: async () => {
            await new Promise<void>((resolve, reject) => {
                server.close(error => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        },
    };
}
