/**
 * Chapa Payment Service
 *
 * Integrates with Chapa (chapa.co) for hosted checkout, verification,
 * and merchant split-settlement provisioning.
 *
 * Docs: https://developer.chapa.co/docs/accept-payments
 */

const CHAPA_BASE_URL = 'https://api.chapa.co/v1';
import { logger } from '@/lib/logger';

const log = logger.child('Chapa');

export interface ChapaInitializeParams {
    amount: number; // ETB amount
    currency?: string; // defaults to 'ETB'
    email?: string;
    first_name: string;
    last_name?: string;
    phone_number?: string; // 09xxxxxxxx or 07xxxxxxxx format
    tx_ref: string; // unique transaction reference
    callback_url: string; // webhook URL Chapa POSTs to on success
    return_url: string; // where to redirect user after payment
    customization?: {
        title?: string;
        description?: string;
        logo?: string;
    };
    meta?: Record<string, string>;
    subaccounts?: {
        id: string;
        split_type?: 'percentage' | 'flat';
        split_value?: number;
    };
}

export interface ChapaInitializeResponse {
    status: 'success' | 'failed';
    message: string;
    data?: {
        checkout_url: string;
    };
}

export interface ChapaVerifyResponse {
    status: 'success' | 'failed';
    message: string;
    data?: {
        amount: string;
        currency: string;
        status: 'success' | 'failed' | 'pending';
        reference: string;
        tx_ref: string;
        customization?: Record<string, string>;
        meta?: Record<string, string>;
    };
}

export interface ChapaBankRecord {
    id: string;
    name: string;
    code: string;
}

export interface ChapaSubaccountParams {
    business_name: string;
    account_name: string;
    bank_code: string;
    account_number: string;
    split_type: 'percentage' | 'flat';
    split_value: number;
}

export interface ChapaSubaccountResponse {
    status: 'success' | 'failed';
    message: string;
    data?: {
        id?: string;
        [key: string]: unknown;
    };
}

/**
 * Initialize a Chapa payment transaction
 * Returns a checkout_url to redirect the user to
 */
export async function initializeChapaTransaction(
    params: ChapaInitializeParams
): Promise<ChapaInitializeResponse> {
    const secretKey = process.env.CHAPA_SECRET_KEY;

    if (!secretKey) {
        throw new Error('CHAPA_SECRET_KEY is not configured');
    }

    const response = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ...params,
            currency: params.currency ?? 'ETB',
        }),
    });

    const data = (await response.json()) as ChapaInitializeResponse;
    return data;
}

/**
 * Fetch the bank list used for merchant settlement account onboarding.
 */
export async function listChapaBanks(): Promise<ChapaBankRecord[]> {
    const secretKey = process.env.CHAPA_SECRET_KEY;

    if (!secretKey) {
        throw new Error('CHAPA_SECRET_KEY is not configured');
    }

    log.info('Fetching banks from Chapa API...');

    const response = await fetch(`${CHAPA_BASE_URL}/banks`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${secretKey}`,
        },
        cache: 'no-store',
    });

    const payload = (await response.json()) as {
        status?: string;
        message?: string;
        data?: Array<Record<string, unknown>>;
    };

    log.info('Chapa banks API response', {
        status: response.status,
        ok: response.ok,
        payloadStatus: payload.status,
        payloadMessage: payload.message,
        dataLength: payload.data?.length ?? 0,
    });

    // Chapa's bank-list docs describe a successful response with the message
    // "Banks retrieved". Do not require status === "success" here because the
    // bank directory response shape differs from payment endpoints.
    if (!response.ok || !Array.isArray(payload.data)) {
        const errorMsg =
            payload.message ?? `Failed to load Chapa banks (status: ${response.status})`;
        log.error('Chapa banks API error', null, { message: errorMsg });
        throw new Error(errorMsg);
    }

    const banks = payload.data
        .map(bank => {
            const id = String(bank.id ?? bank.bank_code ?? bank.code ?? '').trim();
            const name = String(bank.name ?? bank.bank_name ?? bank.title ?? '').trim();
            // Chapa split-payment docs require the bank id / bank_code from the
            // get banks endpoint when creating subaccounts.
            const code = String(bank.bank_code ?? bank.id ?? bank.code ?? bank.slug ?? '').trim();

            if (!id || !name) {
                return null;
            }

            return {
                id,
                name,
                code,
            };
        })
        .filter((bank): bank is ChapaBankRecord => bank !== null)
        .sort((left, right) => left.name.localeCompare(right.name));

    log.info(`Parsed ${banks.length} valid banks from Chapa response`);
    return banks;
}

/**
 * Create a restaurant settlement subaccount for split payments.
 */
export async function createChapaSubaccount(
    params: ChapaSubaccountParams
): Promise<ChapaSubaccountResponse> {
    const secretKey = process.env.CHAPA_SECRET_KEY;

    if (!secretKey) {
        throw new Error('CHAPA_SECRET_KEY is not configured');
    }

    log.info('Creating Chapa subaccount with params', {
        business_name: params.business_name,
        account_name: params.account_name,
        bank_code: params.bank_code,
        split_type: params.split_type,
        split_value: params.split_value,
    });

    const response = await fetch(`${CHAPA_BASE_URL}/subaccount`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });

    const data = (await response.json()) as ChapaSubaccountResponse;

    log.info('Chapa subaccount API response', {
        httpStatus: response.status,
        ok: response.ok,
        status: data.status,
        message: data.message,
        dataId: data.data?.id,
        fullData: data.data,
    });

    return {
        ...data,
        status: data.status ?? (response.ok ? 'success' : 'failed'),
        message:
            data.message ||
            (response.ok ? 'Subaccount created' : 'Failed to create Chapa subaccount'),
    };
}
/**
 * Verify a completed Chapa transaction
 * Always verify server-side before marking order as confirmed
 */
export async function verifyChapaTransaction(txRef: string): Promise<ChapaVerifyResponse> {
    const secretKey = process.env.CHAPA_SECRET_KEY;

    if (!secretKey) {
        throw new Error('CHAPA_SECRET_KEY is not configured');
    }

    const response = await fetch(
        `${CHAPA_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
        {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${secretKey}`,
            },
        }
    );

    const data = (await response.json()) as ChapaVerifyResponse;
    return data;
}

/**
 * Generate a unique, sortable transaction reference for Chapa
 * Format: lole-{restaurant_prefix}-{timestamp}-{random}
 */
export function generateChapaTransactionRef(restaurantSlug: string): string {
    const prefix = restaurantSlug.replace(/[^a-z0-9]/gi, '').slice(0, 8);
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `lole-${prefix}-${timestamp}-${random}`;
}

/**
 * Check whether Chapa is properly configured (secret key present)
 */
export function isChapaConfigured(): boolean {
    const key = process.env.CHAPA_SECRET_KEY;
    return !!key && key.length > 10 && !key.startsWith('MOCK');
}

export function maskSettlementAccountNumber(accountNumber: string): string {
    const trimmed = accountNumber.replace(/\s+/g, '');
    if (trimmed.length <= 4) {
        return trimmed;
    }

    return `${'*'.repeat(Math.max(0, trimmed.length - 4))}${trimmed.slice(-4)}`;
}
