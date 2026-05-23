// Staff Domain Service Interfaces
// Defines contracts for staff-related services in the domain

// ============================================================================
// IPinService
// ============================================================================

export interface IPinService {
    hash(pin: string): Promise<string>;
    verify(storedPin: string | null | undefined, candidatePin: string): Promise<boolean>;
}

// ============================================================================
// IRoleService
// ============================================================================

export type StaffRole = 'owner' | 'admin' | 'manager' | 'kitchen' | 'waiter' | 'bar';

export interface IRoleService {
    isValidRole(role: string): role is StaffRole;
    registerPermissions(role: StaffRole | string, permissions: string[]): void;
    getRegisteredRoles(): string[];
    hasPermission(staff: { role: StaffRole | string }, permission: string): Promise<boolean>;
    getRolePermissions(role: StaffRole | string): Promise<string[]>;
    getRolePermissionsSync(role: StaffRole | string): string[];
    hasPermissionSync(staff: { role: StaffRole | string }, permission: string): boolean;
    refreshPermissions(): Promise<void>;
}

// ============================================================================
// IPermissionService
// ============================================================================

export interface IPermissionService {
    hasPermission(staff: { role: StaffRole | string }, permission: string): Promise<boolean>;
    canAccess(staff: { role: StaffRole | string }, permission: string): Promise<boolean>;
    hasPermissionSync(staff: { role: StaffRole | string }, permission: string): boolean;
}

// ============================================================================
// ICrudService
// ============================================================================

export interface CreateStaffInput {
    restaurantId: string;
    userId?: string;
    name: string;
    email?: string;
    role: string;
    pinCode?: string;
    phone?: string;
}

export interface UpdateStaffInput {
    name?: string;
    email?: string;
    role?: string;
    pinCode?: string;
    phone?: string;
    isActive?: boolean;
}

export interface ICrudService {
    getStaffMember(id: string): Promise<{ role: StaffRole | string } | null>;
    getStaffByUserId(userId: string): Promise<{ role: StaffRole | string } | null>;
    getStaff(
        restaurantId: string,
        options?: {
            includeInactive?: boolean;
            limit?: number;
            offset?: number;
        }
    ): Promise<Array<{ role: StaffRole | string }>>;
    createStaffMember(input: CreateStaffInput): Promise<{ role: StaffRole | string }>;
    updateStaffMember(id: string, input: UpdateStaffInput): Promise<{ role: StaffRole | string }>;
    deactivateStaffMember(id: string): Promise<{ role: StaffRole | string }>;
}
