import { ChapaProvider } from './chapa';
import { TelebirrProvider } from './telebirr';
import {
    PaymentInitiateInput,
    PaymentInitiateWithFallbackResponse,
    PaymentProvider,
    PaymentProviderHealth,
    PaymentProviderName,
    PaymentVerifyResponse,
} from './types';

export class PaymentAdapterRegistry {
    private providers: Record<string, PaymentProvider>;

    constructor(params?: { providers?: PaymentProvider[] }) {
        const providerList = params?.providers ?? [
            new ChapaProvider(process.env.CHAPA_SECRET_KEY ?? ''),
            new TelebirrProvider(process.env.TELEBIRR_APP_ID, process.env.TELEBIRR_APP_KEY),
        ];

        this.providers = providerList.reduce<Record<string, PaymentProvider>>((acc, provider) => {
            acc[provider.name] = provider;
            return acc;
        }, {});
    }

    getProvider(name: PaymentProviderName): PaymentProvider | null {
        return this.providers[name] ?? null;
    }

    async healthChecks(providerNames?: PaymentProviderName[]): Promise<PaymentProviderHealth[]> {
        const names =
            providerNames?.length && providerNames.length > 0
                ? providerNames
                : (Object.keys(this.providers) as PaymentProviderName[]);
        const checks = await Promise.all(
            names.map(async providerName => {
                const provider = this.providers[providerName];
                if (!provider) {
                    return {
                        provider: providerName,
                        status: 'unavailable' as const,
                        checkedAt: new Date().toISOString(),
                        reason: 'Provider is not registered',
                    };
                }
                return provider.healthCheck();
            })
        );
        return checks;
    }

    async initiateWithFallback(params: {
        preferredProvider: PaymentProviderName;
        input: PaymentInitiateInput;
    }): Promise<PaymentInitiateWithFallbackResponse> {
        const provider = this.providers[params.preferredProvider];
        if (!provider) {
            throw new Error(`Provider ${params.preferredProvider} is not registered`);
        }

        try {
            const result = await provider.initiatePayment(params.input);
            return {
                result,
                attempts: [{ provider: provider.name, ok: true }],
                fallbackApplied: false,
            };
        } catch (error) {
            const attempts = [
                {
                    provider: provider.name,
                    ok: false,
                    error: error instanceof Error ? error.message : 'Unknown provider failure',
                },
            ];
            throw new Error(
                `Payment provider failed to initiate payment. ${provider.name}: ${attempts[0].error}`
            );
        }
    }

    async verify(params: {
        provider: PaymentProviderName;
        transactionReference: string;
    }): Promise<PaymentVerifyResponse> {
        const provider = this.getProvider(params.provider);
        if (!provider) {
            throw new Error(`Provider ${params.provider} is not registered`);
        }
        return provider.verifyPayment(params.transactionReference);
    }
}

export function createPaymentAdapterRegistry(): PaymentAdapterRegistry {
    return new PaymentAdapterRegistry();
}
