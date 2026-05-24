import { logger } from '@/lib/logger';
import Courier from '@trycourier/courier';

const log = logger.child('[courier]');

export type CourierChannel = 'sms' | 'push' | 'email';

export interface CourierRecipient {
    user_id?: string;
    phone_number?: string;
    email?: string;
}

export interface CourierMessageTemplate {
    name: string;
    data?: Record<string, unknown>;
}

export interface CourierMessageContent {
    title?: string;
    body?: string;
    subject?: string;
}

export interface CourierOverride {
    sms?: CourierMessageContent;
    push?: CourierMessageContent;
    email?: CourierMessageContent;
}

export interface CourierNotificationParams {
    recipient: CourierRecipient;
    template?: CourierMessageTemplate;
    content?: CourierMessageContent;
    override?: CourierOverride;
    channels?: CourierChannel[];
    idempotencyKey?: string;
    tenantId?: string;
    metadata?: Record<string, unknown>;
}

export interface CourierSendResult {
    success: boolean;
    channel?: CourierChannel;
    messageId?: string;
    provider?: string;
    error?: string;
    providerResponse?: unknown;
}

export interface MultiChannelSendResult {
    success: boolean;
    channel: CourierChannel | 'none';
    results: CourierSendResult[];
    attemptedChannels: CourierChannel[];
}

function getApiKey(): string {
    const token = process.env.COURIER_AUTH_TOKEN || process.env.COURIER_API_KEY;
    if (!token) {
        log.error('COURIER_AUTH_TOKEN or COURIER_API_KEY environment variable not set');
        throw new Error(
            'COURIER_AUTH_TOKEN or COURIER_API_KEY environment variable not configured'
        );
    }
    return token;
}

function createCourierClient(): Courier {
    return new Courier({ apiKey: getApiKey() });
}

export function formatEthiopianPhone(phone: string): string {
    let normalized = phone.replace(/\s+/g, '').trim();

    if (normalized.startsWith('+')) {
        normalized = normalized.slice(1);
    }

    if (normalized.startsWith('251')) {
        return `+${normalized}`;
    }

    if (normalized.startsWith('0')) {
        return `+251${normalized.slice(1)}`;
    }

    if (normalized.startsWith('9') && normalized.length === 9) {
        return `+251${normalized}`;
    }

    if (!normalized.startsWith('251') && !normalized.startsWith('0')) {
        return `+251${normalized}`;
    }

    return `+${normalized}`;
}

function generateIdempotencyKey(baseKey: string, channel: CourierChannel): string {
    return `${baseKey}_${channel}`;
}

function buildCourierTo(recipient: CourierRecipient, tenantId?: string): Record<string, unknown> {
    const to: Record<string, unknown> = {};

    if (recipient.user_id) {
        to.user_id = recipient.user_id;
    }

    if (recipient.email) {
        to.email = recipient.email;
    }

    if (tenantId) {
        to.context = { tenant_id: tenantId };
    }

    return to;
}

function buildCourierRouting(
    channel: CourierChannel,
    _recipient: CourierRecipient
): { method: 'single'; channels: string[] } {
    return {
        method: 'single',
        channels: [channel],
    };
}

async function sendViaCourier(
    params: CourierNotificationParams,
    channel: CourierChannel
): Promise<CourierSendResult> {
    const client = createCourierClient();

    const to = buildCourierTo(params.recipient, params.tenantId);

    const message: Record<string, unknown> = {
        to,
        routing: buildCourierRouting(channel, params.recipient),
    };

    if (params.template) {
        if (params.template.data) {
            message.data = params.template.data;
        }
    }

    if (params.content) {
        const elementalContent: Record<string, unknown> = {
            title: params.content.title,
            body: params.content.body,
        };
        message.content = elementalContent;
    }

    if (params.override?.[channel]) {
        const channelOverride = params.override[channel];
        const elementalOverride = {
            elements: [
                {
                    type: 'text',
                    content: channelOverride.body || channelOverride.subject,
                },
            ],
        };
        message.channels = {
            [channel]: {
                override: elementalOverride,
            },
        };
    }

    const requestOptions: { headers?: Record<string, string> } = {};

    if (params.idempotencyKey) {
        requestOptions.headers = {
            'Idempotency-Key': generateIdempotencyKey(params.idempotencyKey, channel),
        };
    }

    try {
        const response = await client.send.message({ message }, requestOptions);

        return {
            success: true,
            channel,
            messageId: response.requestId,
            provider: 'courier',
            providerResponse: response,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            channel,
            error: errorMessage,
        };
    }
}

export async function sendMultiChannelNotification(
    params: CourierNotificationParams
): Promise<MultiChannelSendResult> {
    const channels = params.channels || ['push', 'sms', 'email'];
    const results: CourierSendResult[] = [];

    for (const channel of channels) {
        const result = await sendViaCourier(params, channel);
        results.push(result);

        if (result.success) {
            log.info('Courier notification sent successfully', {
                channel,
                messageId: result.messageId,
                tenantId: params.tenantId,
            });
            return {
                success: true,
                channel,
                results,
                attemptedChannels: channels.slice(0, channels.indexOf(channel) + 1),
            };
        }

        log.warn('Courier notification failed, trying next channel', {
            channel,
            error: result.error,
            tenantId: params.tenantId,
        });
    }

    return {
        success: false,
        channel: 'none',
        results,
        attemptedChannels: channels,
    };
}

export async function sendCourierNotification(
    params: CourierNotificationParams
): Promise<CourierSendResult> {
    const channel = params.channels?.[0] || 'sms';
    return sendViaCourier(params, channel);
}

export async function sendTransactionalNotification(
    params: CourierNotificationParams
): Promise<CourierSendResult> {
    if (!params.idempotencyKey) {
        throw new Error('Idempotency key is required for transactional notifications');
    }

    return sendCourierNotification(params);
}

export async function sendOrderStatusNotification(
    recipient: CourierRecipient,
    orderNumber: string,
    status: string,
    idempotencyKey: string,
    tenantId?: string
): Promise<MultiChannelSendResult> {
    const statusMessages: Record<string, { title: string; body: string }> = {
        preparing: {
            title: 'Order Preparing',
            body: `Order ${orderNumber} is now being prepared.`,
        },
        ready: {
            title: 'Order Ready',
            body: `Order ${orderNumber} is ready for pickup/service.`,
        },
        served: {
            title: 'Order Completed',
            body: `Order ${orderNumber} has been completed. Thank you!`,
        },
        cancelled: {
            title: 'Order Cancelled',
            body: `Order ${orderNumber} was cancelled.`,
        },
        completed: {
            title: 'Order Completed',
            body: `Order ${orderNumber} has been completed. Thank you!`,
        },
    };

    const statusKey = status.toLowerCase() as keyof typeof statusMessages;
    const message = statusMessages[statusKey] || {
        title: 'Order Update',
        body: `Order ${orderNumber} status is now ${status}.`,
    };

    return sendMultiChannelNotification({
        recipient,
        content: message,
        idempotencyKey,
        tenantId,
        channels: ['push', 'sms', 'email'],
        metadata: { orderNumber, status, type: 'order_status' },
    });
}

export async function sendOtpNotification(
    recipient: CourierRecipient,
    otp: string,
    idempotencyKey: string,
    tenantId?: string
): Promise<MultiChannelSendResult> {
    return sendMultiChannelNotification({
        recipient,
        content: {
            title: 'Your Verification Code',
            body: `Your verification code is: ${otp}. It expires in 5 minutes.`,
        },
        override: {
            sms: {
                body: `Your verification code is: ${otp}`,
            },
            email: {
                subject: 'Your Verification Code',
                body: `Your verification code is: <strong>${otp}</strong><br><br>It expires in 5 minutes.`,
            },
        },
        idempotencyKey,
        tenantId,
        channels: ['sms', 'email'],
        metadata: { type: 'otp', otpLength: otp.length },
    });
}
