import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StaffRow } from '../repository';

const mockRolePermissionsRepo = {
    hasPermissions: vi.fn(),
    getAllRolePermissions: vi.fn(),
};

describe('RoleService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('isValidRole', () => {
        it('returns true for valid roles', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            expect(service.isValidRole('owner')).toBe(true);
            expect(service.isValidRole('admin')).toBe(true);
            expect(service.isValidRole('manager')).toBe(true);
            expect(service.isValidRole('kitchen')).toBe(true);
            expect(service.isValidRole('waiter')).toBe(true);
            expect(service.isValidRole('bar')).toBe(true);
        });

        it('returns false for invalid roles', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            expect(service.isValidRole('invalid')).toBe(false);
            expect(service.isValidRole('superadmin')).toBe(false);
            expect(service.isValidRole('')).toBe(false);
        });
    });

    describe('getRegisteredRoles', () => {
        it('returns all registered role keys', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            const roles = service.getRegisteredRoles();

            expect(roles).toContain('owner');
            expect(roles).toContain('admin');
            expect(roles).toContain('manager');
            expect(roles).toContain('kitchen');
            expect(roles).toContain('waiter');
            expect(roles).toContain('bar');
        });
    });

    describe('registerPermissions', () => {
        it('registers custom permissions for a role', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            service.registerPermissions('custom', ['read', 'write']);

            expect(service.getRolePermissionsSync('custom')).toEqual(['read', 'write']);
        });

        it('overrides default permissions for existing role', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            service.registerPermissions('admin', ['custom:perm']);

            expect(service.getRolePermissionsSync('admin')).toEqual(['custom:perm']);
        });
    });

    describe('getRolePermissionsSync', () => {
        it('returns default permissions for known roles', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            const permissions = service.getRolePermissionsSync('admin');

            expect(permissions).toEqual(
                expect.arrayContaining(['staff:read', 'staff:write', 'orders:read', 'orders:write'])
            );
        });

        it('returns empty array for unknown roles', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            const permissions = service.getRolePermissionsSync('unknown-role');

            expect(permissions).toEqual([]);
        });
    });

    describe('hasPermissionSync', () => {
        it('returns true when staff has permission', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            const staff: StaffRow = {
                id: 's1',
                role: 'admin',
                restaurant_id: 'r1',
                name: 'Test',
                is_active: true,
                created_at: '',
                user_id: null,
                pin_code: null,
                assigned_zones: null,
            };

            expect(service.hasPermissionSync(staff, 'staff:read')).toBe(true);
            expect(service.hasPermissionSync(staff, 'orders:write')).toBe(true);
        });

        it('returns true for owner with all permissions', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            const staff: StaffRow = {
                id: 's1',
                role: 'owner',
                restaurant_id: 'r1',
                name: 'Test',
                is_active: true,
                created_at: '',
                user_id: null,
                pin_code: null,
                assigned_zones: null,
            };

            expect(service.hasPermissionSync(staff, 'any:permission')).toBe(true);
        });

        it('returns false when staff lacks permission', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            const staff: StaffRow = {
                id: 's1',
                role: 'kitchen',
                restaurant_id: 'r1',
                name: 'Test',
                is_active: true,
                created_at: '',
                user_id: null,
                pin_code: null,
                assigned_zones: null,
            };

            expect(service.hasPermissionSync(staff, 'staff:write')).toBe(false);
        });

        it('returns false for unknown role', async () => {
            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            const staff: StaffRow = {
                id: 's1',
                role: 'unknown',
                restaurant_id: 'r1',
                name: 'Test',
                is_active: true,
                created_at: '',
                user_id: null,
                pin_code: null,
                assigned_zones: null,
            };

            expect(service.hasPermissionSync(staff, 'any:permission')).toBe(false);
        });
    });

    describe('async methods with DB loading', () => {
        it('hasPermission loads from DB and checks permission', async () => {
            mockRolePermissionsRepo.hasPermissions.mockResolvedValue(true);
            mockRolePermissionsRepo.getAllRolePermissions.mockResolvedValue({
                admin: ['custom:perm'],
            });

            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            const staff: StaffRow = {
                id: 's1',
                role: 'admin',
                restaurant_id: 'r1',
                name: 'Test',
                is_active: true,
                created_at: '',
                user_id: null,
                pin_code: null,
                assigned_zones: null,
            };

            const result = await service.hasPermission(staff, 'custom:perm');

            expect(result).toBe(true);
            expect(mockRolePermissionsRepo.hasPermissions).toHaveBeenCalled();
        });

        it('hasPermission uses defaults when DB has no permissions', async () => {
            mockRolePermissionsRepo.hasPermissions.mockResolvedValue(false);

            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            const staff: StaffRow = {
                id: 's1',
                role: 'manager',
                restaurant_id: 'r1',
                name: 'Test',
                is_active: true,
                created_at: '',
                user_id: null,
                pin_code: null,
                assigned_zones: null,
            };

            const result = await service.hasPermission(staff, 'staff:read');

            expect(result).toBe(true);
        });

        it('getRolePermissions loads from DB', async () => {
            mockRolePermissionsRepo.hasPermissions.mockResolvedValue(true);
            mockRolePermissionsRepo.getAllRolePermissions.mockResolvedValue({
                custom: ['perm1', 'perm2'],
            });

            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            const permissions = await service.getRolePermissions('custom');

            expect(permissions).toEqual(['perm1', 'perm2']);
        });

        it('refreshPermissions resets and reloads', async () => {
            mockRolePermissionsRepo.hasPermissions.mockResolvedValue(true);
            mockRolePermissionsRepo.getAllRolePermissions.mockResolvedValue({
                refreshed: ['perm'],
            });

            vi.doMock('../role-permissions-repository', () => ({
                rolePermissionsRepository: mockRolePermissionsRepo,
            }));

            const { RoleService } = await import('../role-service');
            const service = new RoleService();
            await service.refreshPermissions();

            expect(mockRolePermissionsRepo.hasPermissions).toHaveBeenCalled();
        });
    });
});
