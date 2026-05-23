import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { container } from '../container';
import {
    STAFF_REPOSITORY,
    STAFF_CRUD_SERVICE,
    ROLE_SERVICE,
    PERMISSION_SERVICE,
    PIN_SERVICE,
    createStaffRepository,
    createStaffCrudService,
    createRoleService,
    createPermissionService,
    createPinService,
    resetStaffContainer,
    registerStaffMocks,
} from '@/domains/staff/container';
import type {
    IStaffRepository,
    ICrudService,
    IRoleService,
    IPermissionService,
    IPinService,
    StaffRole,
} from '@/lib/di';

describe('Staff Container - DI-03 Factory Functions', () => {
    describe('createStaffRepository', () => {
        it('creates a StaffRepository instance', () => {
            const repo = createStaffRepository();
            expect(repo).toBeDefined();
        });

        it('creates independent instances', () => {
            const repo1 = createStaffRepository();
            const repo2 = createStaffRepository();
            expect(repo1).not.toBe(repo2);
        });
    });

    describe('createStaffCrudService', () => {
        it('creates a StaffCrudService with default repository', () => {
            const service = createStaffCrudService();
            expect(service).toBeDefined();
        });

        it('creates a StaffCrudService with injected repository', () => {
            const mockRepo = {
                getStaffMember: vi.fn(),
                getStaffByUserId: vi.fn(),
                getStaff: vi.fn(),
                createStaffMember: vi.fn(),
                updateStaffMember: vi.fn(),
                deactivateStaffMember: vi.fn(),
                verifyPin: vi.fn(),
                getStaffByIds: vi.fn(),
            } as unknown as IStaffRepository;

            const service = createStaffCrudService(mockRepo);
            expect(service).toBeDefined();
        });
    });

    describe('createRoleService', () => {
        it('creates a RoleService instance', () => {
            const service = createRoleService();
            expect(service).toBeDefined();
            expect(service.isValidRole).toBeDefined();
            expect(service.getRolePermissions).toBeDefined();
        });
    });

    describe('createPermissionService', () => {
        it('creates a PermissionService instance', () => {
            const service = createPermissionService();
            expect(service).toBeDefined();
            expect(service.hasPermission).toBeDefined();
            expect(service.hasPermissionSync).toBeDefined();
        });
    });

    describe('createPinService', () => {
        it('creates a PinService instance', () => {
            const service = createPinService();
            expect(service).toBeDefined();
            expect(service.hash).toBeDefined();
            expect(service.verify).toBeDefined();
        });
    });
});

describe('Staff Container - DI-04 Integration', () => {
    beforeEach(() => {
        resetStaffContainer();
    });

    afterEach(() => {
        resetStaffContainer();
    });

    describe('container registration and resolution', () => {
        it('resolves staff repository from container', async () => {
            const repo = await import('@/domains/staff/container');
            // Registration happens on import
            const instance = repo.container.resolve(STAFF_REPOSITORY);
            expect(instance).toBeDefined();
        });

        it('resolves role service from container', async () => {
            const repo = await import('@/domains/staff/container');
            const instance = repo.container.resolve(ROLE_SERVICE);
            expect(instance).toBeDefined();
            expect(instance.isValidRole).toBeDefined();
        });
    });
});

describe('Staff Container - DI-06 Test Mocks', () => {
    afterEach(() => {
        resetStaffContainer();
    });

    it('registers mocks for staff repository', () => {
        const mockRepo = {
            getStaffMember: vi.fn().mockResolvedValue(null),
            getStaffByUserId: vi.fn().mockResolvedValue(null),
            getStaff: vi.fn().mockResolvedValue([]),
            createStaffMember: vi.fn(),
            updateStaffMember: vi.fn(),
            deactivateStaffMember: vi.fn(),
            verifyPin: vi.fn(),
            getStaffByIds: vi.fn(),
        } as unknown as IStaffRepository;

        registerStaffMocks({ staffRepository: mockRepo });

        const resolved = container.resolve(STAFF_REPOSITORY);
        expect(resolved).toBe(mockRepo);
    });

    it('registers mocks for role service', () => {
        const isValidRole = (role: string): role is StaffRole =>
            ['owner', 'admin', 'manager', 'kitchen', 'waiter', 'bar'].includes(role as StaffRole);

        const mockRoleService: IRoleService = {
            isValidRole,
            hasPermission: vi.fn().mockResolvedValue(true),
            getRolePermissions: vi.fn().mockResolvedValue([]),
            getRolePermissionsSync: vi.fn().mockReturnValue([]),
            hasPermissionSync: vi.fn().mockReturnValue(true),
            getRegisteredRoles: vi.fn().mockReturnValue([]),
            registerPermissions: vi.fn(),
            refreshPermissions: vi.fn(),
        };

        registerStaffMocks({ roleService: mockRoleService });

        const resolved = container.resolve(ROLE_SERVICE);
        expect(resolved).toBe(mockRoleService);
        expect(resolved.isValidRole('admin')).toBe(true);
    });

    it('registers mocks for permission service', () => {
        const mockPermissionService: IPermissionService = {
            hasPermission: vi.fn().mockResolvedValue(true),
            canAccess: vi.fn().mockResolvedValue(true),
            hasPermissionSync: vi.fn().mockReturnValue(true),
        };

        registerStaffMocks({ permissionService: mockPermissionService });

        const resolved = container.resolve(PERMISSION_SERVICE);
        expect(resolved).toBe(mockPermissionService);
    });

    it('registers mocks for pin service', async () => {
        const mockPinService: IPinService = {
            hash: vi.fn().mockResolvedValue('hashed'),
            verify: vi.fn().mockResolvedValue(true),
        };

        registerStaffMocks({ pinService: mockPinService });

        const resolved = container.resolve(PIN_SERVICE);
        expect(resolved).toBe(mockPinService);
        await expect(resolved.hash('pin')).resolves.toBe('hashed');
    });

    it('allows mixing real and mock services', async () => {
        // Need to use a fresh container for this test
        const { container: testContainer } = await import('../container');
        const { STAFF_REPOSITORY: mockRepoToken } = await import('@/domains/staff/container');

        const mockRepo = {
            getStaffMember: vi.fn().mockResolvedValue(null),
            getStaffByUserId: vi.fn().mockResolvedValue(null),
            getStaff: vi.fn().mockResolvedValue([]),
            createStaffMember: vi.fn(),
            updateStaffMember: vi.fn(),
            deactivateStaffMember: vi.fn(),
            verifyPin: vi.fn(),
            getStaffByIds: vi.fn(),
        } as unknown as IStaffRepository;

        // Register only the mock
        testContainer.register(mockRepoToken, () => mockRepo, 'singleton');

        // Repository should be mocked
        const repo = testContainer.resolve(STAFF_REPOSITORY);
        expect(repo).toBe(mockRepo);

        // Verify mock was called correctly
        expect(repo.getStaffMember).not.toHaveBeenCalled();
    });
});
