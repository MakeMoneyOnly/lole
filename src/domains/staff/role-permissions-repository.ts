// Staff Domain - Role Permissions Repository
// Database access layer for role_permissions table

import { getRepositoryClient } from '@/lib/db/repository-base';
import { logger } from '@/lib/logger';

export interface RolePermissionRow {
    id: string;
    role: string;
    permission: string;
    created_at: string;
    updated_at: string;
}

export class RolePermissionsRepository {
    /**
     * Get all permissions for a specific role
     */
    async getPermissionsByRole(role: string): Promise<string[]> {
        const { data, error } = await getRepositoryClient()
            .from('role_permissions')
            .select('permission')
            .eq('role', role);

        if (error) {
            logger.error('Error fetching role permissions', error, {
                source: '[staff/role-permissions-repository]',
            });
            throw new Error(error.message);
        }

        return data?.map((row: { permission: string }) => row.permission) ?? [];
    }

    /**
     * Get all role-permission mappings
     * Returns a map of role -> permissions
     */
    async getAllRolePermissions(): Promise<Record<string, string[]>> {
        const { data, error } = await getRepositoryClient()
            .from('role_permissions')
            .select('role, permission');

        if (error) {
            logger.error('Error fetching all role permissions', error, {
                source: '[staff/role-permissions-repository]',
            });
            throw new Error(error.message);
        }

        const result: Record<string, string[]> = {};
        for (const row of data ?? []) {
            if (!result[row.role]) {
                result[row.role] = [];
            }
            result[row.role].push(row.permission);
        }

        return result;
    }

    /**
     * Check if any permissions exist in the database
     */
    async hasPermissions(): Promise<boolean> {
        const { count, error } = await getRepositoryClient()
            .from('role_permissions')
            .select('*', { count: 'exact', head: true });

        if (error) {
            logger.error('Error checking role permissions existence', error, {
                source: '[staff/role-permissions-repository]',
            });
            return false;
        }

        return (count ?? 0) > 0;
    }

    /**
     * Add a permission for a role
     */
    async addPermission(role: string, permission: string): Promise<RolePermissionRow> {
        const { data, error } = await getRepositoryClient()
            .from('role_permissions')
            .insert({ role, permission })
            .select()
            .single();

        if (error) {
            logger.error('Error adding role permission', error, {
                source: '[staff/role-permissions-repository]',
            });
            throw new Error(error.message);
        }

        return data;
    }

    /**
     * Remove a permission for a role
     */
    async removePermission(role: string, permission: string): Promise<void> {
        const { error } = await getRepositoryClient()
            .from('role_permissions')
            .delete()
            .eq('role', role)
            .eq('permission', permission);

        if (error) {
            logger.error('Error removing role permission', error, {
                source: '[staff/role-permissions-repository]',
            });
            throw new Error(error.message);
        }
    }

    /**
     * Set all permissions for a role (replaces existing)
     */
    async setRolePermissions(role: string, permissions: string[]): Promise<void> {
        // First remove all existing permissions for the role
        await getRepositoryClient().from('role_permissions').delete().eq('role', role);

        // Then insert new permissions
        if (permissions.length > 0) {
            const { error } = await getRepositoryClient()
                .from('role_permissions')
                .insert(permissions.map(permission => ({ role, permission })));

            if (error) {
                logger.error('Error setting role permissions', error, {
                    source: '[staff/role-permissions-repository]',
                });
                throw new Error(error.message);
            }
        }
    }
}

export const rolePermissionsRepository = new RolePermissionsRepository();
