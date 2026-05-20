import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StaffRow } from '../repository';

const mockStaffService = {
	getStaff: vi.fn(),
	getStaffMember: vi.fn(),
	getStaffByUserId: vi.fn(),
	createStaffMember: vi.fn(),
	updateStaffMember: vi.fn(),
	deactivateStaffMember: vi.fn(),
	verifyPin: vi.fn(),
	hasPermission: vi.fn(),
};

vi.mock('../service', () => ({
	staffService: mockStaffService,
}));

describe('StaffApplicationService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	async function importService() {
		const { StaffApplicationService } = await import('../application/staff-application-service');
		return new StaffApplicationService();
	}

	describe('getStaff', () => {
		it('returns staff list for valid query', async () => {
			const staffList = [{ id: 's1', name: 'John' }];
			mockStaffService.getStaff.mockResolvedValue(staffList);

			const service = await importService();
			const result = await service.getStaff({
				restaurantId: 'rest-1',
				limit: 10,
				offset: 0,
			});

			expect(result.success).toBe(true);
			expect(result.data).toEqual({ staff: staffList });
			expect(mockStaffService.getStaff).toHaveBeenCalledWith('rest-1', {
				limit: 10,
				offset: 0,
			});
		});

		it('applies role filter', async () => {
			mockStaffService.getStaff.mockResolvedValue([]);

			const service = await importService();
			await service.getStaff({
				restaurantId: 'rest-1',
				role: 'waiter',
			});

			expect(mockStaffService.getStaff).toHaveBeenCalledWith('rest-1', {
				role: 'waiter',
			});
		});

		it('applies isActive filter', async () => {
			mockStaffService.getStaff.mockResolvedValue([]);

			const service = await importService();
			await service.getStaff({
				restaurantId: 'rest-1',
				isActive: true,
			});

			expect(mockStaffService.getStaff).toHaveBeenCalledWith('rest-1', {
				isActive: true,
			});
		});

		it('returns validation error for invalid input', async () => {
			const service = await importService();
			const result = await service.getStaff({
				restaurantId: 'invalid-uuid',
			} as any);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('VALIDATION_ERROR');
		});

		it('returns error on service failure', async () => {
			mockStaffService.getStaff.mockRejectedValue(new Error('DB error'));

			const service = await importService();
			const result = await service.getStaff({
				restaurantId: '00000000-0000-0000-0000-000000000001',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('STAFF_FETCH_FAILED');
		});
	});

	describe('getStaffById', () => {
		it('returns staff member when found', async () => {
			const staff: StaffRow = {
				id: 'staff-1',
				restaurant_id: 'rest-1',
				name: 'John',
				role: 'waiter',
				is_active: true,
				created_at: '',
				user_id: null,
				pin_code: null,
				assigned_zones: null,
			};
			mockStaffService.getStaffMember.mockResolvedValue(staff);

			const service = await importService();
			const result = await service.getStaffById({
				staffId: 'staff-1',
				restaurantId: 'rest-1',
			});

			expect(result.success).toBe(true);
			expect(result.data).toEqual(staff);
		});

		it('returns not found error when staff does not exist', async () => {
			mockStaffService.getStaffMember.mockResolvedValue(null);

			const service = await importService();
			const result = await service.getStaffById({
				staffId: 'nonexistent',
				restaurantId: 'rest-1',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('STAFF_NOT_FOUND');
		});

		it('returns validation error for invalid UUID', async () => {
			const service = await importService();
			const result = await service.getStaffById({
				staffId: 'invalid',
				restaurantId: 'rest-1',
			} as any);

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('VALIDATION_ERROR');
		});
	});

	describe('getStaffByUserId', () => {
		it('returns staff when found by user ID', async () => {
			const staff: StaffRow = {
				id: 'staff-1',
				user_id: 'user-123',
				restaurant_id: 'rest-1',
				name: 'John',
				role: 'waiter',
				is_active: true,
				created_at: '',
				pin_code: null,
				assigned_zones: null,
			};
			mockStaffService.getStaffByUserId.mockResolvedValue(staff);

			const service = await importService();
			const result = await service.getStaffByUserId({
				userId: 'user-123',
				restaurantId: 'rest-1',
			});

			expect(result.success).toBe(true);
			expect(result.data).toEqual(staff);
		});

		it('returns not found error when staff does not exist', async () => {
			mockStaffService.getStaffByUserId.mockResolvedValue(null);

			const service = await importService();
			const result = await service.getStaffByUserId({
				userId: 'nonexistent',
				restaurantId: 'rest-1',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('STAFF_NOT_FOUND');
		});
	});

	describe('createStaff', () => {
		it('creates staff member with valid data', async () => {
			const created: StaffRow = {
				id: 'new-1',
				restaurant_id: 'rest-1',
				name: 'John',
				role: 'waiter',
				is_active: true,
				created_at: '',
				user_id: null,
				pin_code: null,
				assigned_zones: null,
			};
			mockStaffService.createStaffMember.mockResolvedValue(created);

			const service = await importService();
			const result = await service.createStaff({
				restaurantId: 'rest-1',
				name: 'John',
				role: 'waiter',
			});

			expect(result.success).toBe(true);
			expect(result.data).toEqual(created);
		});

		it('returns error for invalid role', async () => {
			const service = await importService();
			const result = await service.createStaff({
				restaurantId: 'rest-1',
				name: 'John',
				role: 'invalid-role' as any,
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('VALIDATION_ERROR');
		});

		it('returns error on service failure', async () => {
			mockStaffService.createStaffMember.mockRejectedValue(new Error('Create failed'));

			const service = await importService();
			const result = await service.createStaff({
				restaurantId: '00000000-0000-0000-0000-000000000001',
				name: 'John',
				role: 'waiter',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('STAFF_CREATE_FAILED');
		});
	});

	describe('updateStaff', () => {
		it('updates staff member with valid data', async () => {
			const updated: StaffRow = {
				id: 'staff-1',
				restaurant_id: 'rest-1',
				name: 'Updated',
				role: 'admin',
				is_active: true,
				created_at: '',
				user_id: null,
				pin_code: null,
				assigned_zones: null,
			};
			mockStaffService.getStaffMember.mockResolvedValue(updated);
			mockStaffService.updateStaffMember.mockResolvedValue(updated);

			const service = await importService();
			const result = await service.updateStaff({
				staffId: 'staff-1',
				restaurantId: 'rest-1',
				name: 'Updated',
			});

			expect(result.success).toBe(true);
			expect(result.data).toEqual(updated);
		});

		it('returns validation error for invalid input', async () => {
			const service = await importService();
			const result = await service.updateStaff({
				staffId: 'invalid',
				restaurantId: 'rest-1',
			} as any);

			expect(result.success).toBe(false);
		});
	});

	describe('deleteStaff', () => {
		it('deactivates staff member', async () => {
			const staff: StaffRow = {
				id: 'staff-1',
				restaurant_id: 'rest-1',
				name: 'John',
				role: 'waiter',
				is_active: false,
				created_at: '',
				user_id: null,
				pin_code: null,
				assigned_zones: null,
			};
			mockStaffService.getStaffMember.mockResolvedValue(staff);
			mockStaffService.deactivateStaffMember.mockResolvedValue(staff);

			const service = await importService();
			const result = await service.deleteStaff({
				staffId: 'staff-1',
				restaurantId: 'rest-1',
			});

			expect(result.success).toBe(true);
			expect(mockStaffService.deactivateStaffMember).toHaveBeenCalledWith('staff-1', 'rest-1');
		});

		it('returns error on failure', async () => {
			mockStaffService.deactivateStaffMember.mockRejectedValue(new Error('Delete failed'));

			const service = await importService();
			const result = await service.deleteStaff({
				staffId: 'staff-1',
				restaurantId: 'rest-1',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('STAFF_DELETE_FAILED');
		});
	});

	describe('verifyPin', () => {
		it('returns staff on valid PIN', async () => {
			const staff: StaffRow = {
				id: 'staff-1',
				restaurant_id: 'rest-1',
				name: 'John',
				role: 'waiter',
				is_active: true,
				created_at: '',
				user_id: null,
				pin_code: null,
				assigned_zones: null,
			};
			mockStaffService.verifyPin.mockResolvedValue(staff);

			const service = await importService();
			const result = await service.verifyPin({
				staffId: 'staff-1',
				pinCode: '1234',
				restaurantId: 'rest-1',
			});

			expect(result.success).toBe(true);
			expect(result.data).toEqual(staff);
		});

		it('returns error for invalid PIN', async () => {
			mockStaffService.verifyPin.mockResolvedValue(null);

			const service = await importService();
			const result = await service.verifyPin({
				staffId: 'staff-1',
				pinCode: '9999',
				restaurantId: 'rest-1',
			});

			expect(result.success).toBe(false);
			expect(result.error?.code).toBe('INVALID_PIN');
		});
	});

	describe('setStaffActive', () => {
		it('sets active status successfully', async () => {
			const updated: StaffRow = {
				id: 'staff-1',
				restaurant_id: 'rest-1',
				name: 'John',
				role: 'waiter',
				is_active: true,
				created_at: '',
				user_id: null,
				pin_code: null,
				assigned_zones: null,
			};
			mockStaffService.getStaffMember.mockResolvedValue(updated);
			mockStaffService.updateStaffMember.mockResolvedValue(updated);

			const service = await importService();
			const result = await service.setStaffActive({
				staffId: 'staff-1',
				restaurantId: 'rest-1',
				isActive: true,
			});

			expect(result.success).toBe(true);
		});
	});

	describe('checkPermission', () => {
		it('returns true when permission granted', async () => {
			mockStaffService.hasPermission.mockResolvedValue(true);

			const service = await importService();
			const result = await service.checkPermission({
				staff: { role: 'admin' },
				permission: 'staff:read',
			});

			expect(result.success).toBe(true);
			expect(result.data).toBe(true);
		});

		it('returns false when permission denied', async () => {
			mockStaffService.hasPermission.mockResolvedValue(false);

			const service = await importService();
			const result = await service.checkPermission({
				staff: { role: 'kitchen' },
				permission: 'staff:write',
			});

			expect(result.success).toBe(true);
			expect(result.data).toBe(false);
		});
	});
});