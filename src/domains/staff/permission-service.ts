// Staff Domain - Permission Service
// Handles permission checking by delegating to RoleService
import { roleService } from './role-service';
import type { StaffRow } from './repository';

export class PermissionService {
    /**
     * Check if a staff member has a specific permission
     * Async version that loads from DB if needed
     */
    async hasPermission(staff: StaffRow, permission: string): Promise<boolean> {
        const permissions = await roleService.getRolePermissions(staff.role);
        return permissions.includes('all') || permissions.includes(permission);
    }

    /**
     * Check if a staff member can access a resource/permission
     * Alias for hasPermission with semantic clarity for access control
     */
    async canAccess(staff: StaffRow, permission: string): Promise<boolean> {
        return this.hasPermission(staff, permission);
    }

    /**
     * Sync version for backward compatibility
     * Uses in-memory permissions only (may not reflect DB changes)
     */
    hasPermissionSync(staff: StaffRow, permission: string): boolean {
        const permissions = roleService.getRolePermissionsSync(staff.role);
        return permissions.includes('all') || permissions.includes(permission);
    }
}

export const permissionService = new PermissionService();
