/**
 * Payment amount DTO
 */
export interface PaymentAmount {
    value: number;
    currency: string;
}

/**
 * Payment customer DTO
 */
export interface PaymentCustomer {
    id?: string;
    email?: string;
    name?: string;
    phone?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Payment metadata DTO
 */
export interface PaymentMetadata {
    orderId?: string;
    restaurantId?: string;
    userId?: string;
    tableId?: string;
    items?: PaymentItemizedItem[];
    notes?: string;
}

/**
 * Payment itemized item
 */
export interface PaymentItemizedItem {
    name: string;
    quantity: number;
    price: number;
    sku?: string;
}

/**
 * Create payment input DTO
 */
export interface CreatePaymentInput {
    amount: PaymentAmount;
    customer: PaymentCustomer;
    paymentMethod: PaymentMethod;
    description?: string;
    metadata?: PaymentMetadata;
    returnUrl?: string;
    cancelUrl?: string;
}

/**
 * Payment method type
 */
export type PaymentMethod = 'card' | 'bank' | 'wallet' | 'cash' | 'gift_card';

/**
 * Payment method details
 */
export interface PaymentMethodDetails {
    type: PaymentMethod;
    cardLast4?: string;
    cardBrand?: string;
    cardExpMonth?: number;
    cardExpYear?: number;
    bankName?: string;
    walletType?: string;
}

/**
 * Create payment output DTO
 */
export interface CreatePaymentOutput {
    paymentId: string;
    clientSecret?: string;
    status: PaymentStatus;
    requiresAction?: boolean;
    nextAction?: PaymentNextAction;
}

/**
 * Payment status
 */
export type PaymentStatus =
    | 'requires_payment_method'
    | 'requires_action'
    | 'processing'
    | 'succeeded'
    | 'failed'
    | 'canceled'
    | 'refunded'
    | 'partially_refunded';

/**
 * Payment next action
 */
export interface PaymentNextAction {
    type: 'redirect' | 'use_cardholder_link' | 'verify_payment';
    redirectUrl?: string;
}

/**
 * Capture payment input DTO
 */
export interface CapturePaymentInput {
    paymentId: string;
    amount?: PaymentAmount;
}

/**
 * Capture payment output DTO
 */
export interface CapturePaymentOutput {
    paymentId: string;
    status: PaymentStatus;
    capturedAmount: PaymentAmount;
    capturedAt: Date;
}

/**
 * Refund payment input DTO
 */
export interface RefundPaymentInput {
    paymentId: string;
    amount?: PaymentAmount;
    reason?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Refund payment output DTO
 */
export interface RefundPaymentOutput {
    refundId: string;
    paymentId: string;
    status: RefundStatus;
    refundedAmount: PaymentAmount;
    refundedAt: Date;
}

/**
 * Refund status
 */
export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'canceled';

/**
 * Payment intent result
 */
export interface PaymentIntentResult {
    paymentId: string;
    status: PaymentStatus;
    amount: PaymentAmount;
    createdAt: Date;
    capturedAt?: Date;
    refundedAt?: Date;
    refunds?: RefundPaymentOutput[];
}

/**
 * Payment Provider Port
 * Defines the contract for payment processing operations
 */
export interface PaymentProviderPort {
    /**
     * Create a new payment intent
     * @param input - Payment creation data
     * @returns Payment intent result
     * @throws AppError on failure
     */
    createPayment(input: CreatePaymentInput): Promise<CreatePaymentOutput>;

    /**
     * Capture an authorized payment
     * @param input - Capture details
     * @returns Capture result
     * @throws AppError on failure
     */
    capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput>;

    /**
     * Refund a payment
     * @param input - Refund details
     * @returns Refund result
     * @throws AppError on failure
     */
    refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput>;

    /**
     * Get payment details
     * @param paymentId - The payment identifier
     * @returns Payment intent result
     * @throws AppError on failure
     */
    getPayment(paymentId: string): Promise<PaymentIntentResult>;

    /**
     * Cancel a pending payment
     * @param paymentId - The payment identifier
     * @returns Cancellation result
     * @throws AppError on failure
     */
    cancelPayment(paymentId: string): Promise<{ paymentId: string; status: PaymentStatus }>;

    /**
     * Verify webhook signature
     * @param payload - Raw payload
     * @param signature - Webhook signature
     * @returns Whether the signature is valid
     */
    verifyWebhook(payload: string, signature: string): Promise<boolean>;
}
