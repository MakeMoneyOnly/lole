import { createHash, createHmac, randomUUID } from 'crypto';
import { logger } from '@/lib/logger';

type PrintMode = 'off' | 'fallback' | 'always';
type PrinterProvider = 'log' | 'webhook';

export interface KdsPrintPolicy {
    mode: PrintMode;
    provider: PrinterProvider;
    webhook_url: string | null;
    copies: number;
    timeout_ms: number;
    max_attempts: number;
    base_backoff_ms: number;
}

export interface KdsPrintPayload {
    restaurantId: string;
    orderId: string;
    orderNumber: string;
    tableNumber?: string | null;
    firedAt: string;
    reason: string;
    items: Array<{
        name: string;
        quantity: number;
        station?: string | null;
        notes?: string | null;
        status?: string | null;
    }>;
}

export const DEFAULT_KDS_PRINT_POLICY: KdsPrintPolicy = {
    mode: 'off',
    provider: 'log',
    webhook_url: null,
    copies: 1,
    timeout_ms: 4000,
    max_attempts: 4,
    base_backoff_ms: 400,
};

export function normalizeKdsPrintPolicy(input: unknown): KdsPrintPolicy {
    const raw = (input ?? {}) as Record<string, unknown>;
    const mode =
        raw.mode === 'fallback' || raw.mode === 'always' || raw.mode === 'off'
            ? raw.mode
            : DEFAULT_KDS_PRINT_POLICY.mode;
    const provider =
        raw.provider === 'webhook' || raw.provider === 'log'
            ? raw.provider
            : DEFAULT_KDS_PRINT_POLICY.provider;
    const webhookUrl =
        typeof raw.webhook_url === 'string' && raw.webhook_url.trim().length > 0
            ? raw.webhook_url.trim()
            : null;
    const copiesRaw = Number(raw.copies ?? DEFAULT_KDS_PRINT_POLICY.copies);
    const copies = Number.isFinite(copiesRaw)
        ? Math.max(1, Math.min(5, Math.floor(copiesRaw)))
        : DEFAULT_KDS_PRINT_POLICY.copies;
    const timeoutRaw = Number(raw.timeout_ms ?? DEFAULT_KDS_PRINT_POLICY.timeout_ms);
    const timeout_ms = Number.isFinite(timeoutRaw)
        ? Math.max(1000, Math.min(20000, Math.floor(timeoutRaw)))
        : DEFAULT_KDS_PRINT_POLICY.timeout_ms;
    const attemptsRaw = Number(raw.max_attempts ?? DEFAULT_KDS_PRINT_POLICY.max_attempts);
    const max_attempts = Number.isFinite(attemptsRaw)
        ? Math.max(1, Math.min(8, Math.floor(attemptsRaw)))
        : DEFAULT_KDS_PRINT_POLICY.max_attempts;
    const backoffRaw = Number(raw.base_backoff_ms ?? DEFAULT_KDS_PRINT_POLICY.base_backoff_ms);
    const base_backoff_ms = Number.isFinite(backoffRaw)
        ? Math.max(100, Math.min(5000, Math.floor(backoffRaw)))
        : DEFAULT_KDS_PRINT_POLICY.base_backoff_ms;

    return {
        mode,
        provider,
        webhook_url: webhookUrl,
        copies,
        timeout_ms,
        max_attempts,
        base_backoff_ms,
    };
}

function resolveBridgeSigningSecret(): string | null {
    const explicit = process.env.KDS_PRINTER_WEBHOOK_SECRET;
    if (explicit && explicit.trim().length >= 16) return explicit.trim();

    const fallback = process.env.HMAC_SECRET;
    if (fallback && fallback.trim().length >= 16) return fallback.trim();
    return null;
}

function signBridgeBody(
    body: string,
    timestamp: string,
    nonce: string,
    secret: string
): { signature: string; bodySha256: string } {
    const bodySha256 = createHash('sha256').update(body).digest('hex');
    const canonical = `v1.${timestamp}.${nonce}.${bodySha256}`;
    const signature = createHmac('sha256', secret).update(canonical).digest('hex');
    return { signature, bodySha256 };
}

async function sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}
function computeBackoffMs(base: number, attempt: number): number {
    const exponent = Math.max(0, attempt - 1);
    const expDelay = base * 2 ** exponent;
    const jitter = Math.floor(Math.random() * Math.max(50, base));
    return Math.min(15_000, expDelay + jitter);
}

function shouldRetryStatus(status: number): boolean {
    if (status === 408 || status === 409 || status === 425 || status === 429) return true;
    return status >= 500;
}

type DispatchResult = {
    provider: PrinterProvider;
    dispatched: boolean;
    reason: string;
    attempts: number;
    event_id: string;
    bridge_status?: number;
};

export async function dispatchKdsPrintJob(
    policy: KdsPrintPolicy,
    payload: KdsPrintPayload
): Promise<DispatchResult> {
    const eventId = randomUUID();
    if (policy.mode === 'off') {
        return {
            provider: policy.provider,
            dispatched: false,
            reason: 'print_mode_off',
            attempts: 0,
            event_id: eventId,
        };
    }

    if (policy.provider === 'webhook' && policy.webhook_url) {
        const secret = resolveBridgeSigningSecret();
        if (!secret) {
            throw new Error(
                'KDS_PRINTER_WEBHOOK_SECRET (or HMAC_SECRET) is required for signed printer webhook dispatch'
            );
        }
        const envelope = {
            event: 'kds.ticket.print.v1',
            event_id: eventId,
            occurred_at: new Date().toISOString(),
            idempotency_key: eventId,
            copies: policy.copies,
            payload,
        };
        const body = JSON.stringify(envelope);

        let lastStatus: number | undefined;
        let lastError: string | null = null;

        for (let attempt = 1; attempt <= policy.max_attempts; attempt += 1) {
            const timestamp = new Date().toISOString();
            const nonce = randomUUID();
            const { signature, bodySha256 } = signBridgeBody(body, timestamp, nonce, secret);

            const controller = new AbortController();
            const timeoutHandle = setTimeout(() => controller.abort(), policy.timeout_ms);
            try {
                const response = await fetch(policy.webhook_url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-lole-event': 'kds.ticket.print.v1',
                        'x-lole-event-id': eventId,
                        'x-lole-idempotency-key': eventId,
                        'x-lole-signature-version': 'v1',
                        'x-lole-signature-timestamp': timestamp,
                        'x-lole-signature-nonce': nonce,
                        'x-lole-signature-sha256': signature,
                        'x-lole-body-sha256': bodySha256,
                        'x-lole-attempt': String(attempt),
                    },
                    body,
                    signal: controller.signal,
                });
                clearTimeout(timeoutHandle);

                if (response.ok) {
                    return {
                        provider: 'webhook',
                        dispatched: true,
                        reason: attempt === 1 ? 'sent_to_webhook' : 'sent_to_webhook_after_retry',
                        attempts: attempt,
                        event_id: eventId,
                        bridge_status: response.status,
                    };
                }

                lastStatus = response.status;
                const retryable = shouldRetryStatus(response.status);
                if (!retryable || attempt === policy.max_attempts) {
                    break;
                }
                await sleep(computeBackoffMs(policy.base_backoff_ms, attempt));
            } catch (error: unknown) {
                clearTimeout(timeoutHandle);
                lastError = String(
                    (error instanceof Error ? error.message : 'bridge_request_failed') ??
                        'bridge_request_failed'
                );
                if (attempt === policy.max_attempts) break;
                await sleep(computeBackoffMs(policy.base_backoff_ms, attempt));
            }
        }

        throw new Error(
            `Printer webhook dispatch failed after retries: status=${String(lastStatus ?? 'none')} error=${lastError ?? 'none'}`
        );
    }

    // Log-mode provider acts as a non-hardware fallback in lower environments.
    logger.warn('[KDS_PRINTER_LOG]', {
        event: 'kds.ticket.print.v1',
        event_id: eventId,
        copies: policy.copies,
        payload,
    });
    return {
        provider: 'log' as const,
        dispatched: true,
        reason: 'logged_print_job',
        attempts: 1,
        event_id: eventId,
    };
}
