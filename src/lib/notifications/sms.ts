import { logger } from '@/lib/logger';

type SmsProvider = 'africas_talking' | 'log';

export interface SmsSendResult {
    success: boolean;
    provider: SmsProvider;
    skipped?: boolean;
    error?: string;
}

export interface OrderStatusSmsInput {
    toPhone: string;
    orderNumber: string;
    status: string;
    etaMinutes?: number;
}

function resolveSmsProvider(): SmsProvider {
    const provider = (process.env.SMS_PROVIDER ?? 'log').trim().toLowerCase();
    if (provider === 'africas_talking' || provider === 'africas-talking') return 'africas_talking';
    return 'log';
}

function normalizePhone(phone: string): string {
    return phone.replace(/\s+/g, '').trim();
}

function buildOrderStatusMessage(input: OrderStatusSmsInput): string {
    const status = input.status.toLowerCase();
    if (status === 'preparing') {
        return `lole: Order ${input.orderNumber} is now being prepared.`;
    }
    if (status === 'ready') {
        return `lole: Order ${input.orderNumber} is ready for pickup/service.`;
    }
    if (status === 'served' || status === 'completed') {
        return `lole: Order ${input.orderNumber} has been completed. Thank you.`;
    }
    if (status === 'cancelled') {
        return `lole: Order ${input.orderNumber} was cancelled.`;
    }
    return `lole: Order ${input.orderNumber} status is now ${input.status}.`;
}

/**
 * Africa's Talking SMS Provider
 * https://africastalking.com/
 *
 * Environment variables required:
 * - AFRICAS_TALKING_API_KEY: API key from Africa's Talking dashboard
 * - AFRICAS_TALKING_USERNAME: Your Africa's Talking username
 * - AFRICAS_TALKING_SENDER_ID: Optional alphanumeric sender ID (max 11 chars)
 */
async function sendWithAfricasTalking(toPhone: string, message: string): Promise<SmsSendResult> {
    const apiKey = process.env.AFRICAS_TALKING_API_KEY;
    const username = process.env.AFRICAS_TALKING_USERNAME;
    const senderId = process.env.AFRICAS_TALKING_SENDER_ID;

    if (!apiKey || !username) {
        return {
            success: false,
            provider: 'africas_talking',
            skipped: true,
            error: "Africa's Talking credentials are not configured (AFRICAS_TALKING_API_KEY, AFRICAS_TALKING_USERNAME)",
        };
    }

    // Normalize phone for Africa's Talking (requires + prefix or local format)
    let normalizedRecipient = normalizePhone(toPhone);
    if (!normalizedRecipient.startsWith('+')) {
        // Assume Ethiopian number if no country code
        if (normalizedRecipient.startsWith('0')) {
            normalizedRecipient = '+251' + normalizedRecipient.slice(1);
        } else if (normalizedRecipient.startsWith('9') && normalizedRecipient.length === 9) {
            normalizedRecipient = '+251' + normalizedRecipient;
        } else {
            normalizedRecipient = '+' + normalizedRecipient;
        }
    }

    const body: Record<string, string> = {
        username,
        to: normalizedRecipient,
        message,
    };

    // Add sender ID if configured (short code or alphanumeric)
    if (senderId) {
        body.from = senderId;
    }

    const response = await fetch('https://api.africastalking.com/version1/messaging', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            apiKey: apiKey,
        },
        body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
        const details = await response.text().catch(() => 'SMS provider error');
        return {
            success: false,
            provider: 'africas_talking',
            error: details.slice(0, 500),
        };
    }

    const result = (await response.json().catch(() => ({}))) as {
        SMSMessageData?: { Recipients?: Array<{ status: string; statusCode: number }> };
    };

    // Check delivery status
    const recipients = result?.SMSMessageData?.Recipients ?? [];
    const firstRecipient = recipients[0];

    if (
        firstRecipient &&
        firstRecipient.statusCode !== 101 &&
        firstRecipient.status?.toLowerCase() !== 'success'
    ) {
        return {
            success: false,
            provider: 'africas_talking',
            error: `Delivery failed: ${firstRecipient.status || 'Unknown error'}`,
        };
    }

    return { success: true, provider: 'africas_talking' };
}

export async function sendSms(toPhone: string, message: string): Promise<SmsSendResult> {
    const normalizedPhone = normalizePhone(toPhone);
    if (!normalizedPhone) {
        return {
            success: false,
            provider: 'log',
            skipped: true,
            error: 'Recipient phone is empty',
        };
    }

    const provider = resolveSmsProvider();
    if (provider === 'africas_talking') {
        return sendWithAfricasTalking(normalizedPhone, message);
    }

    const log = logger.child('[sms]');
    log.warn('[SMS:log]', { toPhone: normalizedPhone, message });
    return { success: true, provider: 'log' };
}

export async function sendOrderStatusSms(input: OrderStatusSmsInput): Promise<SmsSendResult> {
    const message = buildOrderStatusMessage(input);
    return sendSms(input.toPhone, message);
}
