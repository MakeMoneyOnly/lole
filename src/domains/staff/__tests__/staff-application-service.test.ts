import { describe, it, expect, vi, beforeEach } from 'vitest';

const UUID = '00000000-0000-0000-0000-000000000001';

describe('StaffApplicationService', () => {
    beforeEach(async () => {
        vi.resetModules();
    });

    describe('validation', () => {
        it('returns validation error for invalid restaurantId', async () => {
            const { StaffApplicationService } =
                await import('../application/staff-application-service');
            const { registerStaffContainer } = await import('../container');
            registerStaffContainer();
            const service = new StaffApplicationService();

            const result = await service.getStaff({
                restaurantId: 'invalid-uuid',
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns validation error for invalid role in createStaff', async () => {
            const { StaffApplicationService } =
                await import('../application/staff-application-service');
            const { registerStaffContainer } = await import('../container');
            registerStaffContainer();
            const service = new StaffApplicationService();

            const result = await service.createStaff({
                restaurantId: UUID,
                name: 'John',
                role: 'invalid-role' as any,
            });

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns validation error for invalid UUID in getStaffById', async () => {
            const { StaffApplicationService } =
                await import('../application/staff-application-service');
            const { registerStaffContainer } = await import('../container');
            registerStaffContainer();
            const service = new StaffApplicationService();

            const result = await service.getStaffById({
                staffId: 'invalid',
                restaurantId: UUID,
            } as any);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('VALIDATION_ERROR');
        });

        it('returns validation error for invalid input in updateStaff', async () => {
            const { StaffApplicationService } =
                await import('../application/staff-application-service');
            const { registerStaffContainer } = await import('../container');
            registerStaffContainer();
            const service = new StaffApplicationService();

            const result = await service.updateStaff({
                staffId: 'invalid-uuid',
                restaurantId: UUID,
            } as any);

            expect(result.success).toBe(false);
        });
    });

    describe('checkPermission', () => {
        it('returns true when permission granted', async () => {
            const { StaffApplicationService } =
                await import('../application/staff-application-service');
            const { registerStaffContainer } = await import('../container');
            registerStaffContainer();
            const service = new StaffApplicationService();

            const result = await service.checkPermission({
                staff: { role: 'admin' },
                permission: 'staff:read',
            });

            expect(result.success).toBe(true);
            expect(result.data).toBe(true);
        });

        it('returns false when permission denied', async () => {
            const { StaffApplicationService } =
                await import('../application/staff-application-service');
            const { registerStaffContainer } = await import('../container');
            registerStaffContainer();
            const service = new StaffApplicationService();

            const result = await service.checkPermission({
                staff: { role: 'kitchen' },
                permission: 'staff:write',
            });

            expect(result.success).toBe(true);
            expect(result.data).toBe(false);
        });
    });
});
