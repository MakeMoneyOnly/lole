// Staff Domain - Repository Layer
// Database access layer - Supabase queries only, no business logic
import { Database } from '@/types/database';
import { logger } from '@/lib/logger';
import {
    STAFF_LIST_COLUMNS,
    STAFF_DETAIL_COLUMNS,
    columnsToString,
} from '@/lib/constants/query-columns';
import { getRepositoryClient } from '@/lib/db/repository-base';
import { verifyStoredStaffPin } from './pin';

export type StaffRow = Database['public']['Tables']['restaurant_staff']['Row'];

export interface StaffListOptions {
    role?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
}

export class StaffRepository {
    /**
     * Get a single staff member by ID
     */
    async getStaffMember(id: string): Promise<StaffRow | null> {
        const { data, error } = await getRepositoryClient()
            .from('restaurant_staff')
            .select(columnsToString(STAFF_DETAIL_COLUMNS))
            .eq('id', id)
            .maybeSingle();

        if (error) {
            logger.error('Error fetching staff member', error, { source: '[staff/repository]' });
            throw new Error(error.message);
        }

        return data as StaffRow | null;
    }

    /**
     * Get a staff member by user ID (Supabase auth ID)
     */
    async getStaffByUserId(userId: string): Promise<StaffRow | null> {
        const { data, error } = await getRepositoryClient()
            .from('restaurant_staff')
            .select(columnsToString(STAFF_DETAIL_COLUMNS))
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            logger.error('Error fetching staff by user ID', error, { source: '[staff/repository]' });
            throw new Error(error.message);
        }

        return data as StaffRow | null;
    }

    /**
     * Get paginated list of staff for a restaurant
     */
    async getStaff(restaurantId: string, options: StaffListOptions = {}): Promise<StaffRow[]> {
        const limit = Math.min(options.limit ?? 50, 200);
        const offset = options.offset ?? 0;

        let query = getRepositoryClient()
            .from('restaurant_staff')
            .select(columnsToString(STAFF_LIST_COLUMNS))
            .eq('restaurant_id', restaurantId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (options.role) {
            query = query.eq('role', options.role);
        }

        if (options.isActive !== undefined) {
            query = query.eq('is_active', options.isActive);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('Error fetching staff list', error, { source: '[staff/repository]' });
            throw new Error(error.message);
        }

        return (data as unknown as StaffRow[]) ?? [];
    }

    /**
     * Create a new staff member
     */
    async createStaffMember(data: {
        restaurant_id: string;
        user_id?: string;
        name: string;
        email?: string;
        role: string;
        pin_code?: string;
        phone?: string;
        is_active?: boolean;
    }): Promise<StaffRow> {
        const { data: staff, error } = await getRepositoryClient()
            .from('restaurant_staff')
            .insert({
                restaurant_id: data.restaurant_id,
                user_id: data.user_id ?? null,
                name: data.name,
                email: data.email ?? null,
                role: data.role,
                pin_code: data.pin_code ?? null,
                phone: data.phone ?? null,
                is_active: data.is_active ?? true,
            })
            .select()
            .single();

        if (error) {
            logger.error('Error creating staff member', error, { source: '[staff/repository]' });
            throw new Error(error.message);
        }

        return staff!;
    }

    /**
     * Update a staff member
     */
    async updateStaffMember(
        id: string,
        data: {
            name?: string;
            email?: string;
            role?: string;
            pin_code?: string;
            phone?: string;
            is_active?: boolean;
        }
    ): Promise<StaffRow> {
        const { data: staff, error } = await getRepositoryClient()
            .from('restaurant_staff')
            .update({
                ...data,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Error updating staff member', error, { source: '[staff/repository]' });
            throw new Error(error.message);
        }

        return staff!;
    }

    /**
     * Soft delete a staff member (set is_active = false)
     */
    async deactivateStaffMember(id: string): Promise<StaffRow> {
        const { data: staff, error } = await getRepositoryClient()
            .from('restaurant_staff')
            .update({
                is_active: false,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Error deactivating staff member', error, { source: '[staff/repository]' });
            throw new Error(error.message);
        }

        return staff!;
    }

    /**
     * Verify PIN code for a staff member
     * Returns the staff member if PIN is valid, null otherwise
     */
    async verifyPin(staffId: string, pinCode: string): Promise<StaffRow | null> {
        const { data, error } = await getRepositoryClient()
            .from('restaurant_staff')
            .select(columnsToString(STAFF_DETAIL_COLUMNS))
            .eq('id', staffId)
            .eq('is_active', true)
            .maybeSingle();

        if (error) {
            logger.error('Error verifying PIN', error, { source: '[staff/repository]' });
            throw new Error(error.message);
        }

        const staff = data as unknown as StaffRow | null;

        if (!staff || !verifyStoredStaffPin(staff.pin_code, pinCode)) {
            return null;
        }

        return staff;
    }

    /**
     * Batch loader: Get staff members for multiple IDs
     * Used by DataLoader for N+1 query prevention
     */
    async getStaffByIds(ids: string[]): Promise<StaffRow[]> {
        if (ids.length === 0) return [];

        const { data, error } = await getRepositoryClient()
            .from('restaurant_staff')
            .select(columnsToString(STAFF_LIST_COLUMNS))
            .in('id', ids);

        if (error) {
            logger.error('Error fetching staff by IDs', error, { source: '[staff/repository]' });
            throw new Error(error.message);
        }

        return (data as unknown as StaffRow[]) ?? [];
    }
}

export const staffRepository = new StaffRepository();
