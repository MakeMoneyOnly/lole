// Payments Domain - Repository Interface (Ports Layer)
// Defines the contract for payments data persistence operations

import type { PaymentRow, PaymentStatus, PaymentProvider, PaymentListOptions } from './repository';

/**
 * Interface defining the contract for payments repository operations.
 * Implementations are provided by the Adapters layer (e.g., SupabaseRepository).
 */
export interface PaymentRepositoryInterface {
    /**
     * Get a single payment by ID.
     * @param id - The UUID of the payment to retrieve
     * @returns The payment record, or null if not found
     */
    getPayment(id: string): Promise<PaymentRow | null>;

    /**
     * Get payments for an order.
     * @param orderId - The UUID of the order
     * @param options - Optional filtering options
     * @returns Array of payment records
     */
    getPaymentsByOrder(orderId: string, options?: PaymentListOptions): Promise<PaymentRow[]>;

    /**
     * Get payments for a restaurant.
     * @param restaurantId - The UUID of the restaurant
     * @param options - Optional filtering options
     * @returns Array of payment records
     */
    getPaymentsByRestaurant(
        restaurantId: string,
        options?: PaymentListOptions
    ): Promise<PaymentRow[]>;

    /**
     * Create a new payment record.
     * @param data - The payment creation data
     * @returns The created payment record
     */
    createPayment(data: {
        restaurant_id: string;
        order_id: string;
        amount: number;
        currency: string;
        provider: string;
        payment_method: string;
        idempotency_key: string;
        metadata?: Record<string, unknown>;
    }): Promise<PaymentRow>;

    /**
     * Update payment status.
     * @param id - The UUID of the payment to update
     * @param status - The new status value
     * @param transactionId - Optional provider transaction reference
     * @param metadata - Optional metadata to update
     * @returns The updated payment record
     */
    updatePaymentStatus(
        id: string,
        status: PaymentStatus,
        transactionId?: string,
        metadata?: Record<string, unknown>
    ): Promise<PaymentRow>;

    /**
     * Get payment by idempotency key for deduplication.
     * @param idempotencyKey - The idempotency key to search by
     * @returns The payment record, or null if not found
     */
    getPaymentByIdempotencyKey(idempotencyKey: string): Promise<PaymentRow | null>;

    /**
     * Batch loader: Get payments for multiple IDs.
     * Optimized for DataLoader to prevent N+1 query issues.
     * @param ids - Array of payment UUIDs to retrieve
     * @returns Array of matching payment records
     */
    getPaymentsByIds(ids: string[]): Promise<PaymentRow[]>;
}
