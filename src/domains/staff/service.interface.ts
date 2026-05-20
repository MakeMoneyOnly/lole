// Staff Domain - Service Interface (Ports Layer)
// Defines the contract for staff business logic operations

import type { StaffRow, StaffListOptions } from './repository';
import type { CreateStaffInput, UpdateStaffInput } from './service';

/**
 * Interface defining the contract for staff service operations.
 * Implements tenant isolation and business logic validation.
 */
export interface StaffServiceInterface {
    /**
     * Get a single staff member by ID with tenant validation
     * @param id - The UUID of the staff member to retrieve
     * @param expectedRestaurantId - Optional restaurant ID for tenant isolation check
     * @returns The staff member record, or null if not found or tenant violation
     */
    getStaffMember(id: string, expectedRestaurantId?: string): Promise<StaffRow | null>;

    /**
     * Get staff member by user ID (Supabase auth) with tenant validation
     * @param userId - The Supabase auth user ID
     * @param expectedRestaurantId - Optional restaurant ID for tenant isolation check
     * @returns The staff member record, or null if not found or tenant violation
     */
    getStaffByUserId(
        userId: string,
        expectedRestaurantId?: string
    ): Promise<StaffRow | null>;

    /**
     * Get paginated staff list for a restaurant
     * @param restaurantId - The UUID of the restaurant
     * @param options - Optional filtering and pagination options
     * @returns Array of staff member records
     */
    getStaff(restaurantId: string, options?: StaffListOptions): Promise<StaffRow[]>;

    /**
     * Create a new staff member with validation
     * @param input - The staff member creation data
     * @returns The created staff member record
     */
    createStaffMember(input: CreateStaffInput): Promise<StaffRow>;

    /**
     * Update a staff member with validation and tenant isolation check
     * @param id - The UUID of the staff member to update
     * @param input - The partial staff member data to update
     * @param expectedRestaurantId - Optional restaurant ID for tenant isolation check
     * @returns The updated staff member record
     */
    updateStaffMember(
        id: string,
        input: UpdateStaffInput,
        expectedRestaurantId?: string
    ): Promise<StaffRow>;

    /**
     * Deactivate a staff member (soft delete) with tenant isolation check
     * @param id - The UUID of the staff member to deactivate
     * @param expectedRestaurantId - Optional restaurant ID for tenant isolation check
     * @returns The deactivated staff member record
     */
    deactivateStaffMember(
        id: string,
        expectedRestaurantId?: string
    ): Promise<StaffRow>;

    /**
     * Verify PIN code for staff member with tenant validation
     * @param staffId - The UUID of the staff member
     * @param pinCode - The PIN code to verify
     * @param expectedRestaurantId - Optional restaurant ID for tenant isolation check
     * @returns The staff member if PIN is valid, null otherwise
     */
    verifyPin(
        staffId: string,
        pinCode: string,
        expectedRestaurantId?: string
    ): Promise<StaffRow | null>;

/**
      * Check if user has permission for an action
      * @param staff - The staff member record
      * @param permission - The permission string to check
      * @returns True if the staff member has the permission
      */
    hasPermission(staff: StaffRow, permission: string): Promise<boolean>;
}