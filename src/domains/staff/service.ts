// Staff Domain - Service Layer
// Business logic layer - PIN hashing, role validation, etc.
import { staffRepository, StaffRow, StaffListOptions } from './repository';
import { hashStaffPin } from './pin';

export interface CreateStaffInput {
    restaurantId: string;
    userId?: string;
    name: string;
    email?: string;
    role: string;
    pinCode?: string;
    phone?: string;
}

export interface UpdateStaffInput {
    name?: string;
    email?: string;
    role?: string;
    pinCode?: string;
    phone?: string;
    isActive?: boolean;
}

/**
 * Valid staff roles
 */
export const VALID_ROLES = [
    'owner',
    'manager',
    'cashier',
    'waiter',
    'kitchen',
    'expeditor',
] as const;
export type StaffRole = (typeof VALID_ROLES)[number];
export { hashStaffPin } from './pin';

/**
 * Check if a role is valid
 */
export function isValidRole(role: string): role is StaffRole {
    return VALID_ROLES.includes(role as StaffRole);
}

export class StaffService {
    /**
     * Get a single staff member by ID with tenant validation
     */
    async getStaffMember(id: string, expectedRestaurantId?: string): Promise<StaffRow | null> {
        const staff = await staffRepository.getStaffMember(id);

        // Tenant isolation check
        if (staff && expectedRestaurantId && staff.restaurant_id !== expectedRestaurantId) {
            console.error(
                `[staff/service] Tenant isolation violation: Attempted to access staff ${id} from restaurant ${expectedRestaurantId}`
            );
            return null;
        }

        return staff;
    }

    /**
     * Get staff member by user ID (Supabase auth)
     */
    async getStaffByUserId(
        userId: string,
        expectedRestaurantId?: string
    ): Promise<StaffRow | null> {
        const staff = await staffRepository.getStaffByUserId(userId);

        // Tenant isolation check
        if (staff && expectedRestaurantId && staff.restaurant_id !== expectedRestaurantId) {
            console.error(
                `[staff/service] Tenant isolation violation: Attempted to access staff by user ${userId} from restaurant ${expectedRestaurantId}`
            );
            return null;
        }

        return staff;
    }

    /**
     * Get paginated staff list for a restaurant
     */
    async getStaff(restaurantId: string, options: StaffListOptions = {}): Promise<StaffRow[]> {
        return staffRepository.getStaff(restaurantId, options);
    }

    /**
     * Create a new staff member with validation
     */
    async createStaffMember(input: CreateStaffInput): Promise<StaffRow> {
        // Validate role
        if (!isValidRole(input.role)) {
            throw new Error(
                `Invalid role: ${input.role}. Valid roles are: ${VALID_ROLES.join(', ')}`
            );
        }

        // TODO: In production, hash the PIN code with bcrypt
        // For now, store as-is (the repository will handle it)
        // import bcrypt from 'bcryptjs';
        // const hashedPin = input.pinCode ? await bcrypt.hash(input.pinCode, 10) : null;

        return staffRepository.createStaffMember({
            restaurant_id: input.restaurantId,
            user_id: input.userId,
            name: input.name,
            email: input.email,
            role: input.role,
            pin_code: input.pinCode ? hashStaffPin(input.pinCode) : undefined,
            phone: input.phone,
            is_active: true,
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
        if (input.role && !isValidRole(input.role)) {
            throw new Error(
                `Invalid role: ${input.role}. Valid roles are: ${VALID_ROLES.join(', ')}`
            );
        }

        // TODO: Hash PIN if provided
        // const hashedPin = input.pinCode ? await bcrypt.hash(input.pinCode, 10) : undefined;

        return staffRepository.updateStaffMember(id, {
            name: input.name,
            email: input.email,
            role: input.role,
            pin_code: input.pinCode ? hashStaffPin(input.pinCode) : undefined,
            phone: input.phone,
            is_active: input.isActive,
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

        return staffRepository.deactivateStaffMember(id);
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
        // TODO: In production, use bcrypt.compare for hashed PINs
        // const staff = await staffRepository.getStaffMember(staffId);
        // if (!staff || !staff.pin_code) return null;
        // const isValid = await bcrypt.compare(pinCode, staff.pin_code);

        const staff = await staffRepository.verifyPin(staffId, pinCode);

        // Tenant isolation check
        if (staff && expectedRestaurantId && staff.restaurant_id !== expectedRestaurantId) {
            console.error(
                `[staff/service] Tenant isolation violation: PIN verification for staff ${staffId} from restaurant ${expectedRestaurantId}`
            );
            return null;
        }

        return staff;
    }

    /**
     * Check if user has permission for an action
     */
    hasPermission(staff: StaffRow, permission: string): boolean {
        const rolePermissions: Record<StaffRole, string[]> = {
            owner: ['all'],
            manager: [
                'staff:read',
                'staff:write',
                'orders:read',
                'orders:write',
                'menu:read',
                'menu:write',
                'reports:read',
            ],
            cashier: ['orders:read', 'orders:write', 'payments:process'],
            waiter: ['orders:read', 'orders:create', 'orders:update'],
            kitchen: ['orders:read', 'orders:update:status'],
            expeditor: ['orders:read', 'orders:update:status'],
        };

        const permissions = rolePermissions[staff.role as StaffRole] || [];
        return permissions.includes('all') || permissions.includes(permission);
    }
}

export const staffService = new StaffService();
