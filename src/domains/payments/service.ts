// Payments Domain - Service Layer
// Business logic layer - payment validation, provider integration, idempotency
import {
    paymentsRepository,
    PaymentRow,
    PaymentListOptions,
    PaymentStatus,
    PaymentProvider,
} from './repository';

export interface InitiatePaymentInput {
    orderId: string;
    amountSantim: number;
    idempotencyKey: string;
    restaurantId?: string;
    currency?: string;
    provider?: PaymentProvider;
    paymentMethod?: string;
    metadata?: Record<string, unknown>;
}

export interface PaymentResult {
    success: boolean;
    payment: PaymentRow | null;
    redirectUrl?: string;
    error?: string;
}

/**
 * Payment providers configuration
 */
export const PAYMENT_PROVIDERS: Record<
    PaymentProvider,
    { name: string; supportedMethods: string[] }
> = {
    telebirr: { name: 'Telebirr', supportedMethods: ['telebirr', 'ussd'] },
    chapa: { name: 'Chapa', supportedMethods: ['mobile_money', 'card', 'bank_transfer'] },
    cbebirr: { name: 'CBE Birr', supportedMethods: ['cbebirr', 'ussd'] },
    cash: { name: 'Cash', supportedMethods: ['cash'] },
    card: { name: 'Card', supportedMethods: ['credit', 'debit'] },
};

/**
 * Valid payment statuses
 */
export const VALID_STATUSES: PaymentStatus[] = [
    'pending',
    'processing',
    'captured',
    'failed',
    'refunded',
    'cancelled',
];

/**
 * Check if a status transition is valid
 */
function isValidStatusTransition(currentStatus: PaymentStatus, newStatus: PaymentStatus): boolean {
    const transitions: Record<PaymentStatus, PaymentStatus[]> = {
        pending: ['processing', 'captured', 'cancelled', 'failed'],
        processing: ['captured', 'failed', 'cancelled'],
        captured: ['refunded'],
        failed: [],
        refunded: [],
        cancelled: [],
    };

    return transitions[currentStatus]?.includes(newStatus) ?? false;
}

export class PaymentsService {
    /**
     * Get a single payment by ID with tenant validation
     */
    async getPayment(id: string, expectedRestaurantId?: string): Promise<PaymentRow | null> {
        const payment = await paymentsRepository.getPayment(id);

        // Tenant isolation check
        if (payment && expectedRestaurantId && payment.restaurant_id !== expectedRestaurantId) {
            console.error(
                `[payments/service] Tenant isolation violation: Attempted to access payment ${id} from restaurant ${expectedRestaurantId}`
            );
            return null;
        }

        return payment;
    }

    /**
     * Get payments for an order with tenant validation
     */
    async getPaymentsByOrder(
        orderId: string,
        expectedRestaurantId: string,
        options: PaymentListOptions = {}
    ): Promise<PaymentRow[]> {
        const payments = await paymentsRepository.getPaymentsByOrder(orderId, options);

        // Filter by tenant (payments should belong to the restaurant)
        return payments.filter(p => p.restaurant_id === expectedRestaurantId);
    }

    /**
     * Get payments for a restaurant
     */
    async getPaymentsByRestaurant(
        restaurantId: string,
        options: PaymentListOptions = {}
    ): Promise<PaymentRow[]> {
        return paymentsRepository.getPaymentsByRestaurant(restaurantId, options);
    }

    /**
     * Initiate a new payment with idempotency
     */
    async initiatePayment(input: InitiatePaymentInput): Promise<PaymentResult> {
        // Validate amount
        if (input.amountSantim <= 0) {
            return { success: false, payment: null, error: 'Amount must be greater than 0' };
        }

        // Apply defaults
        const provider = input.provider ?? 'cash';
        const paymentMethod = input.paymentMethod ?? 'cash';

        // Validate provider
        const providerConfig = PAYMENT_PROVIDERS[provider];
        if (!providerConfig) {
            return {
                success: false,
                payment: null,
                error: `Invalid payment provider: ${provider}`,
            };
        }

        // Validate payment method for provider
        if (!providerConfig.supportedMethods.includes(paymentMethod)) {
            return {
                success: false,
                payment: null,
                error: `Payment method ${paymentMethod} not supported by ${providerConfig.name}`,
            };
        }

        // Check idempotency key - return existing payment if found
        const existingPayment = await paymentsRepository.getPaymentByIdempotencyKey(
            input.idempotencyKey
        );
        if (existingPayment) {
            return { success: true, payment: existingPayment };
        }

        // Create payment record
        const payment = await paymentsRepository.createPayment({
            restaurant_id: input.restaurantId ?? '',
            order_id: input.orderId,
            amount: input.amountSantim,
            currency: input.currency ?? 'ETB',
            provider: provider,
            payment_method: paymentMethod,
            idempotency_key: input.idempotencyKey,
            metadata: input.metadata,
        });

        // TODO: Integrate with actual payment provider here
        // For now, return success with the payment record
        // In production, this would call the provider's API

        return { success: true, payment };
    }

    /**
     * Update payment status with validation
     */
    async updatePaymentStatus(
        id: string,
        status: PaymentStatus,
        transactionId?: string,
        metadata?: Record<string, unknown>,
        expectedRestaurantId?: string
    ): Promise<PaymentRow> {
        // Verify tenant isolation
        const existing = await this.getPayment(id, expectedRestaurantId);
        if (!existing) {
            throw new Error(`Payment ${id} not found or access denied`);
        }

        // Validate status transition
        if (!isValidStatusTransition(existing.status as PaymentStatus, status)) {
            throw new Error(`Invalid status transition from ${existing.status} to ${status}`);
        }

        return paymentsRepository.updatePaymentStatus(id, status, transactionId, metadata);
    }

    /**
     * Process a cash payment (immediate capture)
     */
    async processCashPayment(
        input: Omit<InitiatePaymentInput, 'provider' | 'paymentMethod'>
    ): Promise<PaymentResult> {
        const result = await this.initiatePayment({
            ...input,
            provider: 'cash',
            paymentMethod: 'cash',
        });

        if (result.success && result.payment) {
            // Cash payments are immediately captured
            await paymentsRepository.updatePaymentStatus(result.payment.id, 'captured', undefined, {
                captured_at: new Date().toISOString(),
            });
            result.payment = await paymentsRepository.getPayment(result.payment.id);
        }

        return result;
    }

    /**
     * Handle payment callback from provider
     */
    async handleProviderCallback(
        paymentId: string,
        status: PaymentStatus,
        transactionId: string,
        metadata?: Record<string, unknown>
    ): Promise<PaymentRow> {
        return paymentsRepository.updatePaymentStatus(paymentId, status, transactionId, metadata);
    }

    /**
     * Refund a payment
     */
    async refundPayment(id: string, expectedRestaurantId?: string): Promise<PaymentRow> {
        const payment = await this.getPayment(id, expectedRestaurantId);
        if (!payment) {
            throw new Error(`Payment ${id} not found or access denied`);
        }

        if (payment.status !== 'captured') {
            throw new Error('Only captured payments can be refunded');
        }

        // TODO: Integrate with payment provider for actual refund
        // For now, just update the status

        return paymentsRepository.updatePaymentStatus(id, 'refunded', undefined, {
            refunded_at: new Date().toISOString(),
            original_transaction_id: payment.provider_reference,
        });
    }
}

export const paymentsService = new PaymentsService();
