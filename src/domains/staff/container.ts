// Staff Domain - DI Container Registration
// Registers all staff domain dependencies for hexagonal architecture

import { container, token } from '@/lib/di/container';
import { StaffRepository } from './repository';
import { StaffService } from './service';
import { StaffCrudService } from './crud-service';
import { StaffApplicationService } from './application/staff-application-service';
import { PinService } from './pin-service';
import { RoleService } from './role-service';
import { PermissionService } from './permission-service';
import { RolePermissionsRepository } from './role-permissions-repository';
import type { IStaffRepository } from '@/lib/di/repository-container';
import type { StaffServiceInterface } from './service.interface';
import type {
    IPinService,
    IRoleService,
    IPermissionService,
    ICrudService,
} from '@/lib/di/interfaces';

// ============================================================================
// DI Tokens
// ============================================================================

export const STAFF_REPOSITORY = token<IStaffRepository>('IStaffRepository');
export const ROLE_PERMISSIONS_REPOSITORY = token<RolePermissionsRepository>(
    'RolePermissionsRepository'
);
export const STAFF_CRUD_SERVICE = token<ICrudService>('StaffCrudService');
export const STAFF_SERVICE = token<StaffServiceInterface>('StaffService');
export const PIN_SERVICE = token<IPinService>('PinService');
export const ROLE_SERVICE = token<IRoleService>('RoleService');
export const PERMISSION_SERVICE = token<IPermissionService>('PermissionService');
export const STAFF_APPLICATION_SERVICE = token<StaffApplicationService>('StaffApplicationService');

// ============================================================================
// Factory Functions (DI-03)
// ============================================================================

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
 * Factory function to create a StaffCrudService instance
 * Used for dependency injection and testing
 */
export function createStaffCrudService(repo?: IStaffRepository): StaffCrudService {
    return new StaffCrudService(repo);
}

/**
 * Factory function to create a PinService instance
 * Used for dependency injection and testing
 */
export function createPinService(): PinService {
    return new PinService();
}

/**
 * Factory function to create a RoleService instance
 * Used for dependency injection and testing
 */
export function createRoleService(): RoleService {
    return new RoleService();
}

/**
 * Factory function to create a PermissionService instance
 * Used for dependency injection and testing
 */
export function createPermissionService(): PermissionService {
    return new PermissionService();
}

/**
 * Factory function to create a StaffService instance
 * Used for dependency injection and testing
 */
export function createStaffService(_crudService?: StaffCrudService): StaffService {
    const service = new StaffService();
    // StaffService depends on staffCrudService internally via module imports
    // For full DI support, consider refactoring to accept dependencies in constructor
    return service;
}

/**
 * Factory function to create a StaffApplicationService instance
 * Used for dependency injection and testing
 */
export function createStaffApplicationService(): StaffApplicationService {
    return new StaffApplicationService();
}

// ============================================================================
// Container Registration
// ============================================================================

let isRegistered = false;

export function registerStaffContainer(): void {
    if (isRegistered) {
        return;
    }

    // Register role permissions repository (singleton)
    container.register(
        ROLE_PERMISSIONS_REPOSITORY,
        () => createRolePermissionsRepository(),
        'singleton'
    );

    // Register repository (singleton)
    container.register(STAFF_REPOSITORY, () => createStaffRepository(), 'singleton');

    // Register CRUD service (transient, depends on repository)
    container.register(
        STAFF_CRUD_SERVICE,
        () => createStaffCrudService(container.resolve(STAFF_REPOSITORY)),
        'transient'
    );

    // Register service (transient)
    container.register(STAFF_SERVICE, () => createStaffService(), 'transient');

    // Register PinService (singleton)
    container.register(PIN_SERVICE, () => createPinService(), 'singleton');

    // Register RoleService (singleton)
    container.register(ROLE_SERVICE, () => createRoleService(), 'singleton');

    // Register PermissionService (singleton)
    container.register(PERMISSION_SERVICE, () => createPermissionService(), 'singleton');

    // Register application service (singleton)
    container.register(
        STAFF_APPLICATION_SERVICE,
        () => createStaffApplicationService(),
        'singleton'
    );

    isRegistered = true;
}

// ============================================================================
// Test Utilities (DI-06)
// ============================================================================

/**
 * Reset the staff container registration state
 * Useful for test isolation
 */
export function resetStaffContainer(): void {
    isRegistered = false;
    container.reset();
}

/**
 * Register mocks for staff services in the container
 * Used for unit testing with DI
 */
export function registerStaffMocks(overrides: {
    staffRepository?: IStaffRepository;
    staffCrudService?: ICrudService;
    roleService?: IRoleService;
    permissionService?: IPermissionService;
    pinService?: IPinService;
}): void {
    resetStaffContainer();

    if (overrides.staffRepository) {
        container.register(STAFF_REPOSITORY, () => overrides.staffRepository!, 'singleton');
    }
    if (overrides.staffCrudService) {
        container.register(STAFF_CRUD_SERVICE, () => overrides.staffCrudService!, 'singleton');
    }
    if (overrides.roleService) {
        container.register(ROLE_SERVICE, () => overrides.roleService!, 'singleton');
    }
    if (overrides.permissionService) {
        container.register(PERMISSION_SERVICE, () => overrides.permissionService!, 'singleton');
    }
    if (overrides.pinService) {
        container.register(PIN_SERVICE, () => overrides.pinService!, 'singleton');
    }

    isRegistered = true;
}

// Auto-register on import
registerStaffContainer();

// ============================================================================
// Convenience Export
// ============================================================================

export { container };
