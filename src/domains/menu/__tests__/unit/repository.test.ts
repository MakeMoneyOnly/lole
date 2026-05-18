/**
 * Menu Domain Repository Tests
 * MED-020: Add missing domain tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the query-columns module
vi.mock('@/lib/constants/query-columns', () => ({
    MENU_ITEM_LIST_COLUMNS: ['id', 'name', 'price'],
    MENU_ITEM_DETAIL_COLUMNS: ['id', 'name', 'price', 'description'],
    CATEGORY_LIST_COLUMNS: ['id', 'name'],
    MODIFIER_GROUP_COLUMNS: ['id', 'name'],
    MODIFIER_OPTION_COLUMNS: ['id', 'name'],
    columnsToString: (cols: string[]) => cols.join(','),
}));

// Helper to create a thenable mock query chain
interface MockQuery {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    then: unknown;
    _setResolvedValue: (val: { data: unknown; error: unknown }) => void;
}

function createMockQuery(
    resolvedValue: { data: unknown; error: unknown } = { data: null, error: null }
): MockQuery {
    let _resolvedValue = resolvedValue;

    const query: MockQuery = {} as MockQuery;

    // Make the query thenable so `await query` works
    query.then = function (
        resolve: (v: { data: unknown; error: unknown }) => void,
        reject?: (e: unknown) => void
    ) {
        if (_resolvedValue.error) {
            // Simulate Supabase behavior: resolve with error, don't reject
            Promise.resolve(_resolvedValue).then(resolve, reject);
        } else {
            Promise.resolve(_resolvedValue).then(resolve, reject);
        }
    };

    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.in = vi.fn(() => query);
    query.limit = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.single = vi.fn(() => {
        const result = { ..._resolvedValue };
        return Promise.resolve(result);
    });
    query.maybeSingle = vi.fn(() => {
        const result = { ..._resolvedValue };
        return Promise.resolve(result);
    });

    // Allow updating the resolved value for specific test scenarios
    query._setResolvedValue = function (val: { data: unknown; error: unknown }) {
        _resolvedValue = val;
    };

    return query;
}
const mockFrom = vi.fn(() => createMockQuery());

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({ from: mockFrom }),
}));

describe('MenuRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getMenuItems', () => {
        it('should return menu items for a restaurant', async () => {
            const mockData = [
                { id: 'item-1', name: 'Injera', price: 50 },
                { id: 'item-2', name: 'Tibs', price: 150 },
            ];
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItems } = await import('../../repository');

            const result = await getMenuItems('restaurant-123');

            expect(mockFrom).toHaveBeenCalledWith('menu_items');
            expect(mockQuery.select).toHaveBeenCalled();
            expect(mockQuery.eq).toHaveBeenCalledWith('restaurant_id', 'restaurant-123');
            expect(result).toEqual(mockData);
        });

        it('should filter by category when provided', async () => {
            const mockQuery = createMockQuery({ data: [], error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItems } = await import('../../repository');

            await getMenuItems('restaurant-123', { categoryId: 'category-1' });

            expect(mockQuery.eq).toHaveBeenCalledWith('category_id', 'category-1');
        });

        it('should filter by availability when availableOnly is true', async () => {
            const mockQuery = createMockQuery({ data: [], error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItems } = await import('../../repository');

            await getMenuItems('restaurant-123', { availableOnly: true });

            expect(mockQuery.eq).toHaveBeenCalledWith('is_available', true);
        });

        it('should apply limit to prevent unbounded results', async () => {
            const mockQuery = createMockQuery({ data: [], error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItems } = await import('../../repository');

            await getMenuItems('restaurant-123', { limit: 10 });

            expect(mockQuery.limit).toHaveBeenCalledWith(10);
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('Database error');
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItems } = await import('../../repository');

            await expect(getMenuItems('restaurant-123')).rejects.toThrow('Database error');
        });

        it('should return empty array when data is null', async () => {
            const mockQuery = createMockQuery({ data: null, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItems } = await import('../../repository');

            const result = await getMenuItems('restaurant-123');

            expect(result).toEqual([]);
        });
    });

    describe('getMenuItem', () => {
        it('should return a single menu item by ID', async () => {
            const mockData = { id: 'item-1', name: 'Injera', price: 50 };
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItem } = await import('../../repository');

            const result = await getMenuItem('item-1');

            expect(mockFrom).toHaveBeenCalledWith('menu_items');
            expect(mockQuery.select).toHaveBeenCalled();
            expect(mockQuery.eq).toHaveBeenCalledWith('id', 'item-1');
            expect(mockQuery.single).toHaveBeenCalled();
            expect(result).toEqual(mockData);
        });

        it('should return null for non-existent item (PGRST116)', async () => {
            const notFoundError = new Error('Not found') as Error & { code: string };
            notFoundError.code = 'PGRST116';
            const mockQuery = createMockQuery({ data: null, error: notFoundError });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItem } = await import('../../repository');

            const result = await getMenuItem('non-existent');

            expect(result).toBeNull();
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('DB error') as Error & { code: string };
            dbError.code = 'OTHER_ERROR';
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItem } = await import('../../repository');

            await expect(getMenuItem('item-1')).rejects.toThrow('DB error');
        });
    });

    describe('getMenuCategories', () => {
        it('should return categories for a restaurant', async () => {
            const mockData = [
                { id: 'cat-1', name: 'Main Dishes' },
                { id: 'cat-2', name: 'Drinks' },
            ];
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuCategories } = await import('../../repository');

            const result = await getMenuCategories('restaurant-123');

            expect(mockFrom).toHaveBeenCalledWith('categories');
            expect(mockQuery.select).toHaveBeenCalled();
            expect(mockQuery.eq).toHaveBeenCalledWith('restaurant_id', 'restaurant-123');
            expect(result).toEqual(mockData);
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('DB error');
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuCategories } = await import('../../repository');

            await expect(getMenuCategories('restaurant-123')).rejects.toThrow('DB error');
        });

        it('should return empty array when data is null', async () => {
            const mockQuery = createMockQuery({ data: null, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuCategories } = await import('../../repository');

            const result = await getMenuCategories('restaurant-123');

            expect(result).toEqual([]);
        });
    });

    describe('getModifierGroups', () => {
        it('should return modifier groups for a menu item', async () => {
            const mockData = [{ id: 'group-1', name: 'Spice Level' }];
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierGroups } = await import('../../repository');

            const result = await getModifierGroups('item-1');

            expect(mockFrom).toHaveBeenCalledWith('modifier_groups');
            expect(mockQuery.select).toHaveBeenCalled();
            expect(mockQuery.eq).toHaveBeenCalledWith('menu_item_id', 'item-1');
            expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
            expect(result).toEqual(mockData);
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('DB error');
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierGroups } = await import('../../repository');

            await expect(getModifierGroups('item-1')).rejects.toThrow('DB error');
        });
    });

    describe('getModifierOptions', () => {
        it('should return modifier options for a group', async () => {
            const mockData = [{ id: 'opt-1', name: 'Extra Spicy' }];
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierOptions } = await import('../../repository');

            const result = await getModifierOptions('group-1');

            expect(mockFrom).toHaveBeenCalledWith('modifier_options');
            expect(mockQuery.select).toHaveBeenCalled();
            expect(mockQuery.eq).toHaveBeenCalledWith('modifier_group_id', 'group-1');
            expect(mockQuery.eq).toHaveBeenCalledWith('is_available', true);
            expect(result).toEqual(mockData);
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('DB error');
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierOptions } = await import('../../repository');

            await expect(getModifierOptions('group-1')).rejects.toThrow('DB error');
        });
    });

    describe('getMenuItemsByIds', () => {
        it('should return empty array for empty IDs', async () => {
            const { getMenuItemsByIds } = await import('../../repository');

            const result = await getMenuItemsByIds([]);

            expect(result).toEqual([]);
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it('should fetch menu items by IDs', async () => {
            const mockData = [
                { id: 'item-1', name: 'Injera' },
                { id: 'item-2', name: 'Tibs' },
            ];
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItemsByIds } = await import('../../repository');

            const result = await getMenuItemsByIds(['item-1', 'item-2']);

            expect(mockFrom).toHaveBeenCalledWith('menu_items');
            expect(mockQuery.in).toHaveBeenCalledWith('id', ['item-1', 'item-2']);
            expect(result).toEqual(mockData);
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('DB error');
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getMenuItemsByIds } = await import('../../repository');

            await expect(getMenuItemsByIds(['item-1'])).rejects.toThrow('DB error');
        });
    });

    describe('getModifierGroupsByMenuItemIds', () => {
        it('should return empty array for empty IDs', async () => {
            const { getModifierGroupsByMenuItemIds } = await import('../../repository');

            const result = await getModifierGroupsByMenuItemIds([]);

            expect(result).toEqual([]);
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it('should fetch modifier groups by menu item IDs', async () => {
            const mockData = [{ id: 'group-1', name: 'Spice Level' }];
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierGroupsByMenuItemIds } = await import('../../repository');

            const result = await getModifierGroupsByMenuItemIds(['item-1', 'item-2']);

            expect(mockFrom).toHaveBeenCalledWith('modifier_groups');
            expect(mockQuery.in).toHaveBeenCalledWith('menu_item_id', ['item-1', 'item-2']);
            expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
            expect(result).toEqual(mockData);
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('DB error');
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierGroupsByMenuItemIds } = await import('../../repository');

            await expect(getModifierGroupsByMenuItemIds(['item-1'])).rejects.toThrow('DB error');
        });
    });

    describe('getModifierOptionsByGroupIds', () => {
        it('should return empty array for empty IDs', async () => {
            const { getModifierOptionsByGroupIds } = await import('../../repository');

            const result = await getModifierOptionsByGroupIds([]);

            expect(result).toEqual([]);
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it('should fetch modifier options by group IDs', async () => {
            const mockData = [{ id: 'opt-1', name: 'Extra Spicy' }];
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierOptionsByGroupIds } = await import('../../repository');

            const result = await getModifierOptionsByGroupIds(['group-1']);

            expect(mockFrom).toHaveBeenCalledWith('modifier_options');
            expect(mockQuery.in).toHaveBeenCalledWith('modifier_group_id', ['group-1']);
            expect(mockQuery.eq).toHaveBeenCalledWith('is_available', true);
            expect(result).toEqual(mockData);
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('DB error');
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierOptionsByGroupIds } = await import('../../repository');

            await expect(getModifierOptionsByGroupIds(['group-1'])).rejects.toThrow('DB error');
        });
    });

    describe('getCategoriesByIds', () => {
        it('should return empty array for empty IDs', async () => {
            const { getCategoriesByIds } = await import('../../repository');

            const result = await getCategoriesByIds([]);

            expect(result).toEqual([]);
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it('should fetch categories by IDs', async () => {
            const mockData = [{ id: 'cat-1', name: 'Main Dishes' }];
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getCategoriesByIds } = await import('../../repository');

            const result = await getCategoriesByIds(['cat-1']);

            expect(mockFrom).toHaveBeenCalledWith('categories');
            expect(mockQuery.in).toHaveBeenCalledWith('id', ['cat-1']);
            expect(result).toEqual(mockData);
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('DB error');
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getCategoriesByIds } = await import('../../repository');

            await expect(getCategoriesByIds(['cat-1'])).rejects.toThrow('DB error');
        });
    });

    describe('getModifierGroupsByIds', () => {
        it('should return empty array for empty IDs', async () => {
            const { getModifierGroupsByIds } = await import('../../repository');

            const result = await getModifierGroupsByIds([]);

            expect(result).toEqual([]);
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it('should fetch modifier groups by IDs', async () => {
            const mockData = [{ id: 'group-1', name: 'Spice Level' }];
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierGroupsByIds } = await import('../../repository');

            const result = await getModifierGroupsByIds(['group-1']);

            expect(mockFrom).toHaveBeenCalledWith('modifier_groups');
            expect(mockQuery.in).toHaveBeenCalledWith('id', ['group-1']);
            expect(result).toEqual(mockData);
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('DB error');
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierGroupsByIds } = await import('../../repository');

            await expect(getModifierGroupsByIds(['group-1'])).rejects.toThrow('DB error');
        });
    });

    describe('getModifierOptionsByIds', () => {
        it('should return empty array for empty IDs', async () => {
            const { getModifierOptionsByIds } = await import('../../repository');

            const result = await getModifierOptionsByIds([]);

            expect(result).toEqual([]);
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it('should fetch modifier options by IDs', async () => {
            const mockData = [{ id: 'opt-1', name: 'Extra Spicy' }];
            const mockQuery = createMockQuery({ data: mockData, error: null });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierOptionsByIds } = await import('../../repository');

            const result = await getModifierOptionsByIds(['opt-1']);

            expect(mockFrom).toHaveBeenCalledWith('modifier_options');
            expect(mockQuery.in).toHaveBeenCalledWith('id', ['opt-1']);
            expect(result).toEqual(mockData);
        });

        it('should throw error on database failure', async () => {
            const dbError = new Error('DB error');
            const mockQuery = createMockQuery({ data: null, error: dbError });
            mockFrom.mockReturnValue(mockQuery);

            const { getModifierOptionsByIds } = await import('../../repository');

            await expect(getModifierOptionsByIds(['opt-1'])).rejects.toThrow('DB error');
        });
    });

    describe('menuRepository default export', () => {
        it('should export all repository functions', async () => {
            const menuRepo = await import('../../repository');

            expect(menuRepo.menuRepository).toBeDefined();
            expect(menuRepo.menuRepository.getMenuItems).toBeInstanceOf(Function);
            expect(menuRepo.menuRepository.getMenuItem).toBeInstanceOf(Function);
            expect(menuRepo.menuRepository.getMenuCategories).toBeInstanceOf(Function);
            expect(menuRepo.menuRepository.getModifierGroups).toBeInstanceOf(Function);
            expect(menuRepo.menuRepository.getModifierOptions).toBeInstanceOf(Function);
            expect(menuRepo.menuRepository.getMenuItemsByIds).toBeInstanceOf(Function);
            expect(menuRepo.menuRepository.getModifierGroupsByMenuItemIds).toBeInstanceOf(Function);
            expect(menuRepo.menuRepository.getModifierOptionsByGroupIds).toBeInstanceOf(Function);
            expect(menuRepo.menuRepository.getCategoriesByIds).toBeInstanceOf(Function);
            expect(menuRepo.menuRepository.getModifierGroupsByIds).toBeInstanceOf(Function);
            expect(menuRepo.menuRepository.getModifierOptionsByIds).toBeInstanceOf(Function);
        });

        it('should have default export equal to menuRepository', async () => {
            const menuRepo = await import('../../repository');

            expect(menuRepo.default).toBe(menuRepo.menuRepository);
        });
    });
});
