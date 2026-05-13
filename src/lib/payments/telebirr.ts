/**
 * Telebirr Payment Provider
 *
 * Implements Telebirr QR-based mobile money payment integration for Ethiopia.
 * Telebirr is the leading mobile money service in Ethiopia with 40M+ users.
 *
 * Documentation: https://developer.telebirr.com/
 */

import {
    PaymentInitiateInput,
    PaymentInitiateResponse,
    PaymentProvider,
    PaymentProviderError,
    PaymentProviderHealth,
    PaymentProviderName,
    PaymentVerifyResponse,
} from './types';
import { createHmac, createHash as _createHash } from 'crypto';

const TELEBIRR_API_URL = 'https://api.telebirr.com/v1';
const TELEBIRR_APP_ID = process.env.TELEBIRR_APP_ID;
const TELEBIRR_APP_KEY = process.env.TELEBIRR_APP_KEY;

/**
 * Telebirr payment request payload
 */
interface _TelebirrPaymentRequest {
    appId: string;
    appKey: string;
    amount: string;
    currency: string;
    subject: string;
    body: string;
    outTradeNo: string;
    notifyUrl: string;
    returnUrl: string;
    receiveName: string;
    timeoutExpress: string;
    timestamp: string;
    nonceStr: string;
    sign: string;
}

/**
 * Telebirr payment response
 */
interface TelebirrPaymentResponse {
    code: string;
    msg: string;
    data?: {
        qrCode?: string;
        outTradeNo?: string;
        tradeNo?: string;
    };
}

/**
 * Telebirr verification response
 */
interface TelebirrVerifyResponse {
    code: string;
    msg: string;
    data?: {
        tradeStatus: 'WAIT_BUYER_PAY' | 'TRADE_SUCCESS' | 'TRADE_CLOSED' | 'TRADE_FINISHED';
        outTradeNo: string;
        tradeNo: string;
        totalAmount: string;
        currency: string;
        buyerId?: string;
    };
}

/**
 * Generate Telebirr signature
 * Uses HMAC-SHA256 with app key
 */
function generateSignature(params: Record<string, string>, appKey: string): string {
    // Sort parameters alphabetically
    const sortedKeys = Object.keys(params).sort();

    // Build query string (excluding empty values)
    const queryString = sortedKeys
        .filter(key => params[key] && params[key].length > 0)
        .map(key => `${key}=${params[key]}`)
        .join('&');

    // Append app key
    const stringToSign = `${queryString}&key=${appKey}`;

    // Generate HMAC-SHA256 hash
    return createHmac('sha256', appKey).update(stringToSign).digest('hex').toUpperCase();
}

/**
 * Generate nonce string for request uniqueness
 */
function generateNonceStr(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Generate timestamp in Telebirr format (yyyyMMddHHmmss)
 */
function generateTimestamp(): string {
    const now = new Date();
    return (
        now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0')
    );
}

/**
 * Validate Telebirr webhook signature
 */
export function verifyTelebirrWebhookSignature(
    payload: string,
    signature: string,
    appKey: string
): boolean {
    if (!appKey) {
        console.error('[Telebirr] Missing app key for webhook verification');
        return false;
    }

    try {
        // Parse the payload
        const params = JSON.parse(payload) as Record<string, string>;

        // Extract and remove the sign from params
        const { sign: receivedSign, ...paramsWithoutSign } = params;

        if (!receivedSign) {
            console.error('[Telebirr] No signature in webhook payload');
            return false;
        }

        // Recalculate signature
        const calculatedSign = generateSignature(paramsWithoutSign, appKey);

        // Constant-time comparison
        return calculatedSign === receivedSign;
    } catch (error) {
        console.error('[Telebirr] Webhook signature verification failed:', error);
        return false;
    }
}

/**
 * Telebirr Payment Provider Implementation
 */
export class TelebirrProvider implements PaymentProvider {
    name: PaymentProviderName = 'telebirr' as PaymentProviderName;
    private appId: string;
    private appKey: string;
    private appUrl: string;

    constructor(appId?: string, appKey?: string, appUrl?: string) {
        this.appId = appId ?? TELEBIRR_APP_ID ?? '';
        this.appKey = appKey ?? TELEBIRR_APP_KEY ?? '';
        this.appUrl = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    }

    /**
     * Check if Telebirr is configured
     */
    isConfigured(): boolean {
        return this.appId.length > 0 && this.appKey.length > 0;
    }

    /**
     * Initiate a Telebirr payment
     * Returns a QR code URL for the customer to scan
     */
    async initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResponse> {
        const { amount, currency, email, metadata, callbackUrl, returnUrl } = input;

        if (!this.isConfigured()) {
            throw new PaymentProviderError({
                provider: this.name,
                code: 'TELEBIRR_NOT_CONFIGURED',
                message:
                    'Telebirr credentials not configured. Set TELEBIRR_APP_ID and TELEBIRR_APP_KEY',
                statusCode: 500,
            });
        }

        // Generate unique transaction reference
        const outTradeNo = `TB${Date.now()}${Math.floor(Math.random() * 10000)}`;
        const timestamp = generateTimestamp();
        const nonceStr = generateNonceStr();

        // Build request parameters
        const params: Record<string, string> = {
            appId: this.appId,
            amount: Math.ceil(amount).toString(), // Telebirr uses integer amounts
            currency: currency || 'ETB',
            subject: (metadata?.subject as string) || 'lole Order',
            body: (metadata?.body as string) || 'Payment for order',
            outTradeNo,
            notifyUrl: callbackUrl || `${this.appUrl}/api/v1/system/webhooks/telebirr`,
            returnUrl: returnUrl || `${this.appUrl}/order/status?ref=${outTradeNo}`,
            receiveName: (metadata?.firstName as string) || email?.split('@')[0] || 'Guest',
            timeoutExpress: '30m', // Payment expires in 30 minutes
            timestamp,
            nonceStr,
        };

        // Generate signature
        params.sign = generateSignature(params, this.appKey);

        try {
            const response = await fetch(`${TELEBIRR_API_URL}/payment/precreate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
            });

            const data = (await response.json()) as TelebirrPaymentResponse;

            if (data.code !== '10000' || !data.data?.qrCode) {
                throw new PaymentProviderError({
                    provider: this.name,
                    code: 'TELEBIRR_INITIATE_FAILED',
                    message: data.msg || 'Failed to initiate Telebirr payment',
                    statusCode: response.status || 502,
                    causeMessage: data.msg,
                });
            }

            return {
                checkoutUrl: data.data.qrCode, // QR code URL for customer to scan
                transactionReference: outTradeNo,
                provider: this.name,
                raw: data as unknown as Record<string, unknown>,
            };
        } catch (error) {
            if (error instanceof PaymentProviderError) {
                throw error;
            }

            throw new PaymentProviderError({
                provider: this.name,
                code: 'TELEBIRR_REQUEST_FAILED',
                message: 'Failed to communicate with Telebirr API',
                statusCode: 502,
                causeMessage: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Verify a Telebirr payment status
     */
    async verifyPayment(transactionReference: string): Promise<PaymentVerifyResponse> {
        if (!this.isConfigured()) {
            throw new PaymentProviderError({
                provider: this.name,
                code: 'TELEBIRR_NOT_CONFIGURED',
                message: 'Telebirr credentials not configured',
                statusCode: 500,
            });
        }

        const timestamp = generateTimestamp();
        const nonceStr = generateNonceStr();

        const params: Record<string, string> = {
            appId: this.appId,
            outTradeNo: transactionReference,
            timestamp,
            nonceStr,
        };

        params.sign = generateSignature(params, this.appKey);

        try {
            const response = await fetch(`${TELEBIRR_API_URL}/payment/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
            });

            const data = (await response.json()) as TelebirrVerifyResponse;

            if (data.code !== '10000') {
                throw new PaymentProviderError({
                    provider: this.name,
                    code: 'TELEBIRR_VERIFY_FAILED',
                    message: data.msg || 'Failed to verify Telebirr payment',
                    statusCode: response.status || 502,
                });
            }

            // Map Telebirr status to our status
            let status: 'pending' | 'success' | 'failed' | 'cancelled';
            switch (data.data?.tradeStatus) {
                case 'TRADE_SUCCESS':
                case 'TRADE_FINISHED':
                    status = 'success';
                    break;
                case 'TRADE_CLOSED':
                    status = 'cancelled';
                    break;
                case 'WAIT_BUYER_PAY':
                default:
                    status = 'pending';
            }

            return {
                status,
                transactionReference: data.data?.outTradeNo || transactionReference,
                providerReference: data.data?.tradeNo,
                amount: parseFloat(data.data?.totalAmount || '0'),
                currency: data.data?.currency || 'ETB',
                metadata: {
                    buyerId: data.data?.buyerId,
                },
            };
        } catch (error) {
            if (error instanceof PaymentProviderError) {
                throw error;
            }

            throw new PaymentProviderError({
                provider: this.name,
                code: 'TELEBIRR_VERIFY_REQUEST_FAILED',
                message: 'Failed to verify payment with Telebirr',
                statusCode: 502,
                causeMessage: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Check Telebirr API health
     */
    async healthCheck(): Promise<PaymentProviderHealth> {
        const checkedAt = new Date().toISOString();

        if (!this.isConfigured()) {
            return {
                provider: this.name,
                status: 'unavailable',
                checkedAt,
                reason: 'Telebirr credentials not configured',
            };
        }

        try {
            // Simple health check - verify API is reachable
            const response = await fetch(`${TELEBIRR_API_URL}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000), // 5 second timeout
            });

            if (response.ok) {
                return {
                    provider: this.name,
                    status: 'healthy',
                    checkedAt,
                };
            }

            return {
                provider: this.name,
                status: 'degraded',
                checkedAt,
                reason: `API returned status ${response.status}`,
            };
        } catch (error) {
            return {
                provider: this.name,
                status: 'unavailable',
                checkedAt,
                reason: error instanceof Error ? error.message : 'Health check failed',
            };
        }
    }
}

// Export singleton instance
export const telebirrProvider = new TelebirrProvider();
