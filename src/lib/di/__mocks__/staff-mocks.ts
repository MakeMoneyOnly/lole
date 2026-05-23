// DI Test Mocks - Factory functions for creating test doubles
// Used with dependency injection for unit testing
// NOTE: This file should only be imported in test files with vitest globals available

import { vi } from 'vitest';
import type { StaffRow } from '@/domains/staff/repository';
import type { IStaffRepository } from '@/lib/di/repository-container';

type MockFn = ReturnType<typeof vi.fn>;

// ============================================================================
// Mock Repository (DI-06)
// ============================================================================

/**
 * Creates a mock staff repository for testing
 * Override any methods as needed for specific test cases
 */
export function createMockStaffRepository(
    overrides?: Partial<IStaffRepository>
): IStaffRepository {
    const defaultStaff: StaffRow = {
        id: 'mock-staff-id',
        restaurant_id: 'mock-restaurant-id',
        user_id: 'mock-user-id',
        name: 'Mock Staff',
        role: 'staff',
        pin_code: null,
        is_active: true,
        assigned_zones: null,
        created_at: new Date().toISOString(),
    };

    return {
        getStaffMember: vi.fn().mockResolvedValue(defaultStaff),
        getStaffByUserId: vi.fn().mockResolvedValue(defaultStaff),
        getStaff: vi.fn().mockResolvedValue([defaultStaff]),
        createStaffMember: vi.fn().mockResolvedValue(defaultStaff),
        updateStaffMember: vi.fn().mockResolvedValue(defaultStaff),
        deactivateStaffMember: vi.fn().mockResolvedValue(defaultStaff),
        verifyPin: vi.fn().mockResolvedValue(defaultStaff),
        getStaffByIds: vi.fn().mockResolvedValue([defaultStaff]),
        ...overrides,
    };
}

// ============================================================================
// Mock Service (DI-06)
// ============================================================================

/**
 * Creates a mock staff service for testing
 */
export function createMockStaffService(): {
    getStaffMember: MockFn;
    getStaffByUserId: MockFn;
    getStaff: MockFn;
    createStaffMember: MockFn;
    updateStaffMember: MockFn;
    deactivateStaffMember: MockFn;
    verifyPin: MockFn;
    hasPermission: MockFn;
} {
    const defaultStaff: StaffRow = {
        id: 'mock-staff-id',
        restaurant_id: 'mock-restaurant-id',
        user_id: 'mock-user-id',
        name: 'Mock Staff',
        role: 'staff',
        pin_code: null,
        is_active: true,
        assigned_zones: null,
        created_at: new Date().toISOString(),
    };

    return {
        getStaffMember: vi.fn().mockResolvedValue(defaultStaff),
        getStaffByUserId: vi.fn().mockResolvedValue(defaultStaff),
        getStaff: vi.fn().mockResolvedValue([defaultStaff]),
        createStaffMember: vi.fn().mockResolvedValue(defaultStaff),
        updateStaffMember: vi.fn().mockResolvedValue(defaultStaff),
        deactivateStaffMember: vi.fn().mockResolvedValue(defaultStaff),
        verifyPin: vi.fn().mockResolvedValue(defaultStaff),
        hasPermission: vi.fn().mockResolvedValue(true),
    };
}

// ============================================================================
// Test Utilities (DI-06)
// ============================================================================

/**
 * Setup DI container with mocks for testing
 * Call this in beforeEach or individual tests
 */
export function setupDIMocks() {
    const mockRepo = createMockStaffRepository();
    const mockService = createMockStaffService();

    return { mockRepo, mockService };
}

/**
 * Assert that a mock was called with expected arguments
 * Helper for cleaner test assertions
 */
export async function expectMockCalled<T>(
    mockFn: MockFn,
    expectedArgs?: unknown
): Promise<T | undefined> {
    expect(mockFn).toHaveBeenCalled();
    if (expectedArgs !== undefined) {
        expect(mockFn).toHaveBeenCalledWith(expectedArgs);
    }
    return mockFn.mock.results[0]?.value;
}