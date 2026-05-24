export type PaymentStatus = 'pending' | 'success' | 'failed' | 'cancelled';

export type PaymentProviderName = 'chapa' | 'telebirr' | 'internal';

export type PaymentProviderHealthStatus = 'healthy' | 'degraded' | 'unavailable';

export type PaymentInitiateInput = {
    amount: number;
    currency: string;
    email?: string;
    metadata?: Record<string, unknown>;
    returnUrl?: string;
    callbackUrl?: string;
    subaccountId?: string;
    splitType?: 'percentage' | 'flat';
    splitValue?: number;
};

export interface PaymentInitiateResponse {
    checkoutUrl: string;
    transactionReference: string;
    provider: PaymentProviderName;
    raw?: Record<string, unknown>;
}

export interface PaymentVerifyResponse {
    status: PaymentStatus;
    transactionReference: string;
    providerReference?: string;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
}

export interface PaymentProviderHealth {
    provider: PaymentProviderName;
    status: PaymentProviderHealthStatus;
    checkedAt: string;
    reason?: string;
}

export type PaymentAttempt = {
    provider: PaymentProviderName;
    ok: boolean;
    error?: string;
};

export type PaymentInitiateWithFallbackResponse = {
    result: PaymentInitiateResponse;
    attempts: PaymentAttempt[];
    fallbackApplied: boolean;
};

export interface PaymentProvider {
    name: PaymentProviderName;
    initiatePayment(input: PaymentInitiateInput): Promise<PaymentInitiateResponse>;
    verifyPayment(transactionReference: string): Promise<PaymentVerifyResponse>;
    healthCheck(): Promise<PaymentProviderHealth>;
}

export class PaymentProviderError extends Error {
    provider: PaymentProviderName;
    code: string;
    statusCode: number;
    causeMessage?: string;

    constructor(params: {
        provider: PaymentProviderName;
        code: string;
        message: string;
        statusCode?: number;
        causeMessage?: string;
    }) {
        super(params.message);
        this.name = 'PaymentProviderError';
        this.provider = params.provider;
        this.code = params.code;
        this.statusCode = params.statusCode ?? 502;
        this.causeMessage = params.causeMessage;
    }
}
