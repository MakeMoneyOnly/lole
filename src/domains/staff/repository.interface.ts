// Staff Domain - Repository Interface (Ports Layer)
// Defines the contract for staff data persistence operations

import type { StaffRow, StaffListOptions } from './repository';

/**
 * Interface defining the contract for staff repository operations.
 * Implementations are provided by the Adapters layer (e.g., SupabaseRepository).
 */
export interface StaffRepositoryInterface {
    /**
     * Retrieve a single staff member by their unique identifier.
     * @param id - The UUID of the staff member to retrieve
     * @returns The staff member record, or null if not found
     */
    getStaffMember(id: string): Promise<StaffRow | null>;

    /**
     * Retrieve a staff member by their associated user ID (Supabase auth ID).
     * @param userId - The Supabase auth user ID
     * @returns The staff member record, or null if not found
     */
    getStaffByUserId(userId: string): Promise<StaffRow | null>;

    /**
     * Retrieve a paginated list of staff members for a restaurant.
     * @param restaurantId - The UUID of the restaurant
     * @param options - Optional filtering and pagination options
     * @returns Array of staff member records
     */
    getStaff(restaurantId: string, options?: StaffListOptions): Promise<StaffRow[]>;

    /**
     * Create a new staff member record.
     * @param data - The staff member creation data
     * @returns The created staff member record
     */
    createStaffMember(data: {
        restaurant_id: string;
        user_id?: string;
        name: string;
        email?: string;
        role: string;
        pin_code?: string;
        phone?: string;
        is_active?: boolean;
    }): Promise<StaffRow>;

    /**
     * Update an existing staff member record.
     * @param id - The UUID of the staff member to update
     * @param data - The partial staff member data to update
     * @returns The updated staff member record
     */
    updateStaffMember(
        id: string,
        data: {
            name?: string;
            email?: string;
            role?: string;
            pin_code?: string;
            phone?: string;
            is_active?: boolean;
        }
    ): Promise<StaffRow>;

    /**
     * Soft delete a staff member by setting is_active to false.
     * @param id - The UUID of the staff member to deactivate
     * @returns The deactivated staff member record
     */
    deactivateStaffMember(id: string): Promise<StaffRow>;

    /**
     * Verify a PIN code for a staff member.
     * @param staffId - The UUID of the staff member
     * @param pinCode - The PIN code to verify
     * @returns The staff member if PIN is valid and staff is active, null otherwise
     */
    verifyPin(staffId: string, pinCode: string): Promise<StaffRow | null>;

    /**
     * Batch loader for retrieving multiple staff members by IDs.
     * Optimized for DataLoader to prevent N+1 query issues.
     * @param ids - Array of staff member UUIDs to retrieve
     * @returns Array of matching staff member records
     */
    getStaffByIds(ids: string[]): Promise<StaffRow[]>;
}
