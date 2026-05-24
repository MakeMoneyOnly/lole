// Staff Domain - Role Service
// Handles role validation and permission checking
import { STAFF_ROLES, StaffRole } from '@/types/status';
import type { StaffRow } from './repository';
import { rolePermissionsRepository } from './role-permissions-repository';
import { logger } from '@/lib/logger';

/**
 * Default role permissions map
 * Used as fallback when database has no permission records
 */
const DEFAULT_ROLE_PERMISSIONS: Record<StaffRole, string[]> = {
    owner: ['all'],
    admin: [
        'staff:read',
        'staff:write',
        'orders:read',
        'orders:write',
        'menu:read',
        'menu:write',
        'reports:read',
    ],
    manager: [
        'staff:read',
        'staff:write',
        'orders:read',
        'orders:write',
        'menu:read',
        'menu:write',
        'reports:read',
    ],
    kitchen: ['orders:read', 'orders:update:status'],
    waiter: ['orders:read', 'orders:create', 'orders:update'],
    bar: ['orders:read', 'orders:update:status'],
};

export class RoleService {
    private rolePermissions: Record<string, string[]> = { ...DEFAULT_ROLE_PERMISSIONS };
    private loaded = false;

    /**
     * Load permissions from database
     * Falls back to defaults if no database records exist
     */
    private async loadPermissions(): Promise<void> {
        if (this.loaded) return;

        try {
            const hasDbPermissions = await rolePermissionsRepository.hasPermissions();
            if (hasDbPermissions) {
                const dbPermissions = await rolePermissionsRepository.getAllRolePermissions();
                this.rolePermissions = { ...DEFAULT_ROLE_PERMISSIONS, ...dbPermissions };
            }
        } catch (error) {
            logger.warn('Failed to load permissions from database, using defaults', {
                error: error instanceof Error ? error.message : String(error),
                source: '[staff/role-service]',
            });
        }

        this.loaded = true;
    }

    /**
     * Check if a role is valid
     */
    isValidRole(role: string): role is StaffRole {
        return STAFF_ROLES.includes(role as StaffRole);
    }

    /**
     * Register or update permissions for a role (in-memory only)
     * Enables OCP compliance - extend permissions without modifying core logic
     */
    registerPermissions(role: StaffRole | string, permissions: string[]): void {
        this.rolePermissions[role] = permissions;
    }

    /**
     * Get all registered roles
     */
    getRegisteredRoles(): string[] {
        return Object.keys(this.rolePermissions);
    }

    /**
     * Check if user has permission for an action
     * Loads from DB on first call, then uses cached permissions
     */
    async hasPermission(staff: StaffRow, permission: string): Promise<boolean> {
        await this.loadPermissions();
        const permissions = this.rolePermissions[staff.role as StaffRole] || [];
        return permissions.includes('all') || permissions.includes(permission);
    }

    /**
     * Get all permissions for a role
     * Loads from DB on first call, then uses cached permissions
     */
    async getRolePermissions(role: StaffRole | string): Promise<string[]> {
        await this.loadPermissions();
        return this.rolePermissions[role] || [];
    }

    /**
     * Get all permissions for a role (sync version for backward compatibility)
     * Returns instance permissions (can include registered custom permissions)
     */
    getRolePermissionsSync(role: StaffRole | string): string[] {
        return this.rolePermissions[role] || [];
    }

    /**
     * Check if user has permission for an action (sync version)
     * Uses default permissions without DB loading
     */
    hasPermissionSync(staff: StaffRow, permission: string): boolean {
        const permissions = this.getRolePermissionsSync(staff.role);
        return permissions.includes('all') || permissions.includes(permission);
    }

    /**
     * Refresh permissions from database
     * Useful after updating permissions via repository
     */
    async refreshPermissions(): Promise<void> {
        this.loaded = false;
        await this.loadPermissions();
    }
}

export const roleService = new RoleService();
