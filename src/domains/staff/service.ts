// Staff Domain - Service Layer
// Business logic layer - PIN hashing, role validation, tenant isolation
import { StaffRow, StaffListOptions } from './repository';
import { staffCrudService, CreateStaffInput, UpdateStaffInput } from './crud-service';
import { STAFF_ROLES, StaffRole } from '@/types/status';
import { logger } from '@/lib/logger';
import { pinService } from './pin-service';
import { roleService } from './role-service';
import { permissionService } from './permission-service';

export type { CreateStaffInput, UpdateStaffInput } from './crud-service';

export function checkTenantIsolation(
    entity: StaffRow | null,
    expectedRestaurantId: string | undefined,
    context: string
): StaffRow | null {
    if (entity && expectedRestaurantId && entity.restaurant_id !== expectedRestaurantId) {
        logger.error(`Tenant isolation violation: ${context}`, undefined, {
            source: '[staff/service]',
        });
        return null;
    }
    return entity;
}

export class StaffService {
    /**
     * Get a single staff member by ID with tenant validation
     */
    async getStaffMember(id: string, expectedRestaurantId?: string): Promise<StaffRow | null> {
        const staff = await staffCrudService.getStaffMember(id);
        return checkTenantIsolation(
            staff,
            expectedRestaurantId,
            `Attempted to access staff ${id} from restaurant ${expectedRestaurantId}`
        );
    }

    /**
     * Get staff member by user ID (Supabase auth)
     */
    async getStaffByUserId(
        userId: string,
        expectedRestaurantId?: string
    ): Promise<StaffRow | null> {
        const staff = await staffCrudService.getStaffByUserId(userId);
        return checkTenantIsolation(
            staff,
            expectedRestaurantId,
            `Attempted to access staff by user ${userId} from restaurant ${expectedRestaurantId}`
        );
    }

    /**
     * Get paginated staff list for a restaurant
     */
    async getStaff(restaurantId: string, options: StaffListOptions = {}): Promise<StaffRow[]> {
        return staffCrudService.getStaff(restaurantId, options);
    }

    /**
     * Create a new staff member with validation
     */
    async createStaffMember(input: CreateStaffInput): Promise<StaffRow> {
        // Validate role
        if (!roleService.isValidRole(input.role)) {
            throw new Error(
                `Invalid role: ${input.role}. Valid roles are: ${STAFF_ROLES.join(', ')}`
            );
        }

        // Hash the PIN code with bcrypt
        const hashedPin = input.pinCode ? await pinService.hash(input.pinCode) : undefined;

        return staffCrudService.createStaffMember({
            ...input,
            pinCode: hashedPin,
        });
    }

    /**
     * Update a staff member with validation
     */
    async updateStaffMember(
        id: string,
        input: UpdateStaffInput,
        expectedRestaurantId?: string
    ): Promise<StaffRow> {
        // Verify tenant isolation
        const existing = await this.getStaffMember(id, expectedRestaurantId);
        if (!existing) {
            throw new Error(`Staff member ${id} not found or access denied`);
        }

        // Validate role if provided
        if (input.role && !roleService.isValidRole(input.role)) {
            throw new Error(
                `Invalid role: ${input.role}. Valid roles are: ${STAFF_ROLES.join(', ')}`
            );
        }

        // Hash PIN if provided
        const hashedPin = input.pinCode ? await pinService.hash(input.pinCode) : undefined;

        return staffCrudService.updateStaffMember(id, {
            ...input,
            pinCode: hashedPin,
        });
    }

    /**
     * Deactivate a staff member (soft delete)
     */
    async deactivateStaffMember(id: string, expectedRestaurantId?: string): Promise<StaffRow> {
        // Verify tenant isolation
        const existing = await this.getStaffMember(id, expectedRestaurantId);
        if (!existing) {
            throw new Error(`Staff member ${id} not found or access denied`);
        }

        return staffCrudService.deactivateStaffMember(id);
    }

    /**
     * Verify PIN code for staff member
     * Returns the staff member if valid, null otherwise
     */
    async verifyPin(
        staffId: string,
        pinCode: string,
        expectedRestaurantId?: string
    ): Promise<StaffRow | null> {
        const staff = await staffCrudService.getStaffMember(staffId);
        if (!staff || !staff.pin_code) {
            return null;
        }

        const isValid = await pinService.verify(staff.pin_code, pinCode);
        if (!isValid) {
            return null;
        }

        return checkTenantIsolation(
            staff,
            expectedRestaurantId,
            `PIN verification for staff ${staffId} from restaurant ${expectedRestaurantId}`
        );
    }

    /**
     * Check if user has permission for an action
     */
    async hasPermission(staff: StaffRow, permission: string): Promise<boolean> {
        return permissionService.hasPermission(staff, permission);
    }
}

export const staffService = new StaffService();

export { hashStaffPinBcrypt, verifyStoredStaffPinBcrypt } from './pin';

export function isValidRole(role: string): role is StaffRole {
    return roleService.isValidRole(role);
}
