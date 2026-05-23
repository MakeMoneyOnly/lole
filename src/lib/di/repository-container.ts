// Repository Container - DI Pattern for Repositories
// Provides type-safe repository interfaces and a container for dependency injection

import { StaffRepository, StaffRow, StaffListOptions } from '@/domains/staff/repository';
import { RolePermissionsRepository } from '@/domains/staff/role-permissions-repository';
import { PaymentsRepository, PaymentRow, PaymentListOptions, PaymentStatus } from '@/domains/payments/repository';
import { menuRepository } from '@/domains/menu/repository';
import { ordersRepository } from '@/domains/orders/repository';
import { guestsRepository } from '@/domains/guests/repository';
import { cartRepository } from '@/domains/cart/repository';

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

export interface IRolePermissionsRepository {
    getPermissionsByRole(role: string): Promise<string[]>;
    getAllRolePermissions(): Promise<Record<string, string[]>>;
    hasPermissions(): Promise<boolean>;
    addPermission(role: string, permission: string): Promise<{ id: string; role: string; permission: string; created_at: string; updated_at: string }>;
    removePermission(role: string, permission: string): Promise<void>;
    setRolePermissions(role: string, permissions: string[]): Promise<void>;
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
// Repository Factory Functions (DI-02)
// ============================================

/**
 * Factory function to create a StaffRepository instance
 * Used for dependency injection and testing
 */
export function createStaffRepository(): StaffRepository {
    return new StaffRepository();
}

/**
 * Factory function to create a RolePermissionsRepository instance
 * Used for dependency injection and testing
 */
export function createRolePermissionsRepository(): RolePermissionsRepository {
    return new RolePermissionsRepository();
}

/**
 * Factory function to create a PaymentsRepository instance
 * Used for dependency injection and testing
 */
export function createPaymentsRepository(): PaymentsRepository {
    return new PaymentsRepository();
}

/**
 * Factory function to create the default repository container
 * Pre-registers all repositories for backward compatibility
 */
export function createRepositoryContainer(): RepositoryContainer {
    const container = new RepositoryContainer();
    
    // Register all repository implementations
    container.register<IStaffRepository>('IStaffRepository', createStaffRepository());
    container.register<IPaymentsRepository>('IPaymentsRepository', createPaymentsRepository());
    container.register<IRolePermissionsRepository>('IRolePermissionsRepository', createRolePermissionsRepository());
    
    // Also register singleton instances for direct use
    container.register('menuRepository', menuRepository);
    container.register('ordersRepository', ordersRepository);
    container.register('guestsRepository', guestsRepository);
    container.register('cartRepository', cartRepository);
    
    return container;
}

// ============================================
// Default Container with Pre-registered Repositories
// ============================================

export const repositoryContainer = createRepositoryContainer();