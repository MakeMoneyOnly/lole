// Repository Container - DI Pattern for Repositories
// Provides type-safe repository interfaces and a container for dependency injection

import { StaffRepository, StaffRow, StaffListOptions } from '@/domains/staff/repository';
import { PaymentsRepository, PaymentRow, PaymentListOptions, PaymentStatus } from '@/domains/payments/repository';

// ============================================
// Repository Interfaces (Ports)
// ============================================

export interface IStaffRepository {
    getStaffMember(id: string): Promise<StaffRow | null>;
    getStaffByUserId(userId: string): Promise<StaffRow | null>;
    getStaff(restaurantId: string, options?: StaffListOptions): Promise<StaffRow[]>;
    createStaffMember(data: {
        restaurant_id: string;
        user_id?: string;
        name: string;
        email?: string;
        role: string;
        pin_code?: string;
        phone?: string;
        is_active?: boolean;
    }): Promise<StaffRow>;
    updateStaffMember(id: string, data: {
        name?: string;
        email?: string;
        role?: string;
        pin_code?: string;
        phone?: string;
        is_active?: boolean;
    }): Promise<StaffRow>;
    deactivateStaffMember(id: string): Promise<StaffRow>;
    verifyPin(staffId: string, pinCode: string): Promise<StaffRow | null>;
    getStaffByIds(ids: string[]): Promise<StaffRow[]>;
}

export interface IPaymentsRepository {
    getPayment(id: string): Promise<PaymentRow | null>;
    getPaymentsByOrder(orderId: string, options?: PaymentListOptions): Promise<PaymentRow[]>;
    getPaymentsByRestaurant(restaurantId: string, options?: PaymentListOptions): Promise<PaymentRow[]>;
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
    updatePaymentStatus(id: string, status: PaymentStatus, transactionId?: string, metadata?: Record<string, unknown>): Promise<PaymentRow>;
    getPaymentByIdempotencyKey(idempotencyKey: string): Promise<PaymentRow | null>;
    getPaymentsByIds(ids: string[]): Promise<PaymentRow[]>;
}

// Repository token type
type RepositoryToken = string;

// ============================================
// Repository Container
// ============================================

export class RepositoryContainer {
    private repositories = new Map<RepositoryToken, unknown>();

    register<T>(token: RepositoryToken, repository: T): void {
        this.repositories.set(token, repository);
    }

    get<T>(token: RepositoryToken): T {
        const repository = this.repositories.get(token);
        if (!repository) {
            throw new Error(`Repository not registered for token: ${token}`);
        }
        return repository as T;
    }

    has(token: RepositoryToken): boolean {
        return this.repositories.has(token);
    }
}

// ============================================
// Default Container with Pre-registered Repositories
// ============================================

export const repositoryContainer = new RepositoryContainer();

// Register default implementations for backward compatibility
const staffRepo = new StaffRepository();
const paymentsRepo = new PaymentsRepository();

repositoryContainer.register<IStaffRepository>('IStaffRepository', staffRepo);
repositoryContainer.register<IPaymentsRepository>('IPaymentsRepository', paymentsRepo);