import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
const mockClient: { from: ReturnType<typeof vi.fn> } = {
	from: vi.fn(),
};

function createQueryBuilder() {
	const qb: Record<string, ReturnType<typeof vi.fn>> = {};
	qb.select = vi.fn().mockReturnThis();
	qb.insert = vi.fn().mockReturnThis();
	qb.update = vi.fn().mockReturnThis();
	qb.delete = vi.fn().mockReturnThis();
	qb.eq = vi.fn().mockReturnThis();
	qb.neq = vi.fn().mockReturnThis();
	qb.in = vi.fn().mockReturnThis();
	qb.order = vi.fn().mockReturnThis();
	// range needs to return this for chaining, then the final await resolves
	qb.range = vi.fn().mockReturnThis();
	qb.single = vi.fn().mockResolvedValue({ data: null, error: null });
	qb.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
	return qb;
}

vi.mock('@/lib/db/repository-base', () => ({
	getRepositoryClient: vi.fn(() => mockClient),
}));

vi.mock('@/lib/constants/query-columns', () => ({
	STAFF_LIST_COLUMNS: ['id', 'name', 'role', 'is_active'],
	STAFF_DETAIL_COLUMNS: ['id', 'name', 'role', 'pin_code', 'is_active', 'restaurant_id'],
	columnsToString: vi.fn((cols: readonly string[]) => cols.join(',')),
}));

vi.mock('@/lib/logger', () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
	},
}));

describe('StaffRepository', () => {
	beforeEach(() => {
		vi.resetModules();
		Object.assign(mockQueryBuilder, createQueryBuilder());
		mockClient.from = vi.fn().mockReturnValue(mockQueryBuilder);
		// Make the query builder itself then-able for the final await
		// This allows: const { data, error } = await query;
		// We need to simulate: query.eq(...).eq(...).range(...) returns a Promise when awaited
	});

	async function importRepo() {
		const { StaffRepository } = await import('../repository');
		return new StaffRepository();
	}

	describe('getStaffMember', () => {
		it('returns staff member when found', async () => {
			const staffData = { id: 'staff-1', name: 'John', role: 'waiter', restaurant_id: 'rest-1' };
			mockQueryBuilder.maybeSingle.mockResolvedValue({ data: staffData, error: null });

			const repo = await importRepo();
			const result = await repo.getStaffMember('staff-1');

			expect(result).toEqual(staffData);
			expect(mockClient.from).toHaveBeenCalledWith('restaurant_staff');
			expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'staff-1');
		});

		it('returns null when staff not found', async () => {
			mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

			const repo = await importRepo();
			const result = await repo.getStaffMember('nonexistent');

			expect(result).toBeNull();
		});

		it('throws error on database error', async () => {
			mockQueryBuilder.maybeSingle.mockResolvedValue({
				data: null,
				error: { message: 'Database error' },
			});

			const repo = await importRepo();
			await expect(repo.getStaffMember('staff-1')).rejects.toThrow('Database error');
		});
	});

	describe('getStaffByUserId', () => {
		it('returns staff member when found by user ID', async () => {
			const staffData = { id: 'staff-1', user_id: 'user-123', name: 'John' };
			mockQueryBuilder.maybeSingle.mockResolvedValue({ data: staffData, error: null });

			const repo = await importRepo();
			const result = await repo.getStaffByUserId('user-123');

			expect(result).toEqual(staffData);
			expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123');
		});

		it('returns null when not found', async () => {
			mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

			const repo = await importRepo();
			const result = await repo.getStaffByUserId('nonexistent');

			expect(result).toBeNull();
		});
	});

	describe('getStaff', () => {
		it('returns staff list with default pagination', async () => {
			const staffList = [
				{ id: 's1', name: 'John' },
				{ id: 's2', name: 'Jane' },
			];
			// Make the query builder then-able - when awaited, it returns data/error
			// The repository does: const { data, error } = await query;
			// So we need the query builder to resolve to { data: staffList, error: null }
			Object.defineProperty(mockQueryBuilder, Symbol.asyncIterator, {
				value: undefined,
			});
			const thenableQuery = Object.assign(mockQueryBuilder, {
				then: (resolve: any) => resolve({ data: staffList, error: null }),
			});
			mockClient.from = vi.fn().mockReturnValue(thenableQuery);

			const repo = await importRepo();
			const result = await repo.getStaff('rest-1');

			expect(result).toEqual(staffList);
			expect(mockQueryBuilder.eq).toHaveBeenCalledWith('restaurant_id', 'rest-1');
			expect(mockQueryBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
			expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 49);
		});

		it('applies role filter after range', async () => {
			const thenableQuery = Object.assign(mockQueryBuilder, {
				then: (resolve: any) => resolve({ data: [], error: null }),
			});
			mockClient.from = vi.fn().mockReturnValue(thenableQuery);

			const repo = await importRepo();
			await repo.getStaff('rest-1', { role: 'waiter' });

			expect(mockQueryBuilder.eq).toHaveBeenCalledWith('role', 'waiter');
		});

		it('applies isActive filter after range', async () => {
			const thenableQuery = Object.assign(mockQueryBuilder, {
				then: (resolve: any) => resolve({ data: [], error: null }),
			});
			mockClient.from = vi.fn().mockReturnValue(thenableQuery);

			const repo = await importRepo();
			await repo.getStaff('rest-1', { isActive: true });

			expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_active', true);
		});

		it('limits to max 200 items', async () => {
			const thenableQuery = Object.assign(mockQueryBuilder, {
				then: (resolve: any) => resolve({ data: [], error: null }),
			});
			mockClient.from = vi.fn().mockReturnValue(thenableQuery);

			const repo = await importRepo();
			await repo.getStaff('rest-1', { limit: 500 });

			expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 199);
		});

		it('returns empty array when data is null', async () => {
			const thenableQuery = Object.assign(mockQueryBuilder, {
				then: (resolve: any) => resolve({ data: null, error: null }),
			});
			mockClient.from = vi.fn().mockReturnValue(thenableQuery);

			const repo = await importRepo();
			const result = await repo.getStaff('rest-1');

			expect(result).toEqual([]);
		});
	});

	describe('createStaffMember', () => {
		it('creates staff member with required fields', async () => {
			const created = { id: 'new-1', name: 'John', role: 'waiter', restaurant_id: 'rest-1' };
			mockQueryBuilder.single.mockResolvedValue({ data: created, error: null });

			const repo = await importRepo();
			const result = await repo.createStaffMember({
				restaurant_id: 'rest-1',
				name: 'John',
				role: 'waiter',
			});

			expect(result).toEqual(created);
			expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					restaurant_id: 'rest-1',
					name: 'John',
					role: 'waiter',
					user_id: null,
					email: null,
					pin_code: null,
					phone: null,
					is_active: true,
				})
			);
		});

		it('creates staff member with all optional fields', async () => {
			const created = { id: 'new-2', name: 'Jane' };
			mockQueryBuilder.single.mockResolvedValue({ data: created, error: null });

			const repo = await importRepo();
			await repo.createStaffMember({
				restaurant_id: 'rest-1',
				user_id: 'user-1',
				name: 'Jane',
				email: 'jane@example.com',
				role: 'admin',
				pin_code: '1234',
				phone: '555-1234',
				is_active: false,
			});

			expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
				expect.objectContaining({
					user_id: 'user-1',
					email: 'jane@example.com',
					pin_code: '1234',
					phone: '555-1234',
					is_active: false,
				})
			);
		});

		it('throws on error', async () => {
			mockQueryBuilder.single.mockResolvedValue({
				data: null,
				error: { message: 'Insert failed' },
			});

			const repo = await importRepo();
			await expect(
				repo.createStaffMember({
					restaurant_id: 'rest-1',
					name: 'John',
					role: 'waiter',
				})
			).rejects.toThrow('Insert failed');
		});
	});

	describe('updateStaffMember', () => {
		it('updates staff member with provided fields', async () => {
			const updated = { id: 'staff-1', name: 'Updated Name' };
			mockQueryBuilder.single.mockResolvedValue({ data: updated, error: null });

			const repo = await importRepo();
			const result = await repo.updateStaffMember('staff-1', {
				name: 'Updated Name',
			});

			expect(result).toEqual(updated);
			expect(mockQueryBuilder.update).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'Updated Name',
					updated_at: expect.any(String),
				})
			);
		});

		it('throws on error', async () => {
			mockQueryBuilder.single.mockResolvedValue({
				data: null,
				error: { message: 'Update failed' },
			});

			const repo = await importRepo();
			await expect(repo.updateStaffMember('staff-1', { name: 'New' })).rejects.toThrow(
				'Update failed'
			);
		});
	});

	describe('deactivateStaffMember', () => {
		it('soft deletes staff member by setting is_active to false', async () => {
			const deactivated = { id: 'staff-1', is_active: false };
			mockQueryBuilder.single.mockResolvedValue({ data: deactivated, error: null });

			const repo = await importRepo();
			const result = await repo.deactivateStaffMember('staff-1');

			expect(result).toEqual(deactivated);
			expect(mockQueryBuilder.update).toHaveBeenCalledWith(
				expect.objectContaining({
					is_active: false,
					updated_at: expect.any(String),
				})
			);
		});
	});

	describe('verifyPin', () => {
		it('returns staff when active and found', async () => {
			const staffData = { id: 'staff-1', is_active: true };
			mockQueryBuilder.maybeSingle.mockResolvedValue({ data: staffData, error: null });

			const repo = await importRepo();
			const result = await repo.verifyPin('staff-1', '1234');

			expect(result).toEqual(staffData);
			expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'staff-1');
			expect(mockQueryBuilder.eq).toHaveBeenCalledWith('is_active', true);
		});

		it('returns null when not found', async () => {
			mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

			const repo = await importRepo();
			const result = await repo.verifyPin('staff-1', '1234');

			expect(result).toBeNull();
		});
	});

	describe('getStaffByIds', () => {
		it('returns staff for multiple IDs', async () => {
			const staffList = [
				{ id: 's1', name: 'John' },
				{ id: 's2', name: 'Jane' },
			];
			mockQueryBuilder.in.mockResolvedValue({ data: staffList, error: null });

			const repo = await importRepo();
			const result = await repo.getStaffByIds(['s1', 's2']);

			expect(result).toEqual(staffList);
			expect(mockQueryBuilder.in).toHaveBeenCalledWith('id', ['s1', 's2']);
		});

		it('returns empty array for empty input', async () => {
			const repo = await importRepo();
			const result = await repo.getStaffByIds([]);

			expect(result).toEqual([]);
		});

		it('returns empty array when data is null', async () => {
			mockQueryBuilder.in.mockResolvedValue({ data: null, error: null });

			const repo = await importRepo();
			const result = await repo.getStaffByIds(['s1']);

			expect(result).toEqual([]);
		});
	});
});