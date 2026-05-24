import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { StaffRow } from '../repository';

const mockRoleService = {
    getRolePermissions: vi.fn(),
    getRolePermissionsSync: vi.fn(),
};

describe('PermissionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('hasPermission', () => {
        it('returns true when staff has permission', async () => {
            mockRoleService.getRolePermissions.mockResolvedValue(['read', 'write']);

            vi.doMock('../role-service', () => ({
                roleService: mockRoleService,
            }));

            const { PermissionService } = await import('../permission-service');
            const service = new PermissionService();
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

            const result = await service.hasPermission(staff, 'read');

            expect(result).toBe(true);
            expect(mockRoleService.getRolePermissions).toHaveBeenCalledWith('admin');
        });

        it('returns true when permissions include "all"', async () => {
            mockRoleService.getRolePermissions.mockResolvedValue(['all']);

            vi.doMock('../role-service', () => ({
                roleService: mockRoleService,
            }));

            const { PermissionService } = await import('../permission-service');
            const service = new PermissionService();
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

            const result = await service.hasPermission(staff, 'any:permission');

            expect(result).toBe(true);
        });

        it('returns false when staff lacks permission', async () => {
            mockRoleService.getRolePermissions.mockResolvedValue(['read']);

            vi.doMock('../role-service', () => ({
                roleService: mockRoleService,
            }));

            const { PermissionService } = await import('../permission-service');
            const service = new PermissionService();
            const staff: StaffRow = {
                id: 's1',
                role: 'user',
                restaurant_id: 'r1',
                name: 'Test',
                is_active: true,
                created_at: '',
                user_id: null,
                pin_code: null,
                assigned_zones: null,
            };

            const result = await service.hasPermission(staff, 'write');

            expect(result).toBe(false);
        });

        it('returns false when no permissions exist', async () => {
            mockRoleService.getRolePermissions.mockResolvedValue([]);

            vi.doMock('../role-service', () => ({
                roleService: mockRoleService,
            }));

            const { PermissionService } = await import('../permission-service');
            const service = new PermissionService();
            const staff: StaffRow = {
                id: 's1',
                role: 'user',
                restaurant_id: 'r1',
                name: 'Test',
                is_active: true,
                created_at: '',
                user_id: null,
                pin_code: null,
                assigned_zones: null,
            };

            const result = await service.hasPermission(staff, 'read');

            expect(result).toBe(false);
        });
    });

    describe('canAccess', () => {
        it('is an alias for hasPermission', async () => {
            mockRoleService.getRolePermissions.mockResolvedValue(['read']);

            vi.doMock('../role-service', () => ({
                roleService: mockRoleService,
            }));

            const { PermissionService } = await import('../permission-service');
            const service = new PermissionService();
            const staff: StaffRow = {
                id: 's1',
                role: 'user',
                restaurant_id: 'r1',
                name: 'Test',
                is_active: true,
                created_at: '',
                user_id: null,
                pin_code: null,
                assigned_zones: null,
            };

            const result = await service.canAccess(staff, 'read');

            expect(result).toBe(true);
            expect(mockRoleService.getRolePermissions).toHaveBeenCalledWith('user');
        });
    });

    describe('hasPermissionSync', () => {
        it('returns true when staff has permission (sync)', async () => {
            mockRoleService.getRolePermissionsSync.mockReturnValue(['read', 'write']);

            vi.doMock('../role-service', () => ({
                roleService: mockRoleService,
            }));

            const { PermissionService } = await import('../permission-service');
            const service = new PermissionService();
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

            const result = service.hasPermissionSync(staff, 'write');

            expect(result).toBe(true);
            expect(mockRoleService.getRolePermissionsSync).toHaveBeenCalledWith('admin');
        });

        it('returns true when permissions include "all" (sync)', async () => {
            mockRoleService.getRolePermissionsSync.mockReturnValue(['all']);

            vi.doMock('../role-service', () => ({
                roleService: mockRoleService,
            }));

            const { PermissionService } = await import('../permission-service');
            const service = new PermissionService();
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

            const result = service.hasPermissionSync(staff, 'any:permission');

            expect(result).toBe(true);
        });

        it('returns false when staff lacks permission (sync)', async () => {
            mockRoleService.getRolePermissionsSync.mockReturnValue(['read']);

            vi.doMock('../role-service', () => ({
                roleService: mockRoleService,
            }));

            const { PermissionService } = await import('../permission-service');
            const service = new PermissionService();
            const staff: StaffRow = {
                id: 's1',
                role: 'user',
                restaurant_id: 'r1',
                name: 'Test',
                is_active: true,
                created_at: '',
                user_id: null,
                pin_code: null,
                assigned_zones: null,
            };

            const result = service.hasPermissionSync(staff, 'write');

            expect(result).toBe(false);
        });
    });
});
