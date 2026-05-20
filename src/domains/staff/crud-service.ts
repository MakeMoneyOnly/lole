// Staff Domain - CRUD Service Layer
// Pure CRUD operations - delegates to repository, no tenant isolation or business logic
import type { StaffRow, StaffListOptions } from './repository';
import type { IStaffRepository } from '@/lib/di/repository-container';
import { staffRepository } from './repository';

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

export class StaffCrudService {
    constructor(private readonly repo: IStaffRepository = staffRepository) {}

    async getStaffMember(id: string): Promise<StaffRow | null> {
        return this.repo.getStaffMember(id);
    }

    async getStaffByUserId(userId: string): Promise<StaffRow | null> {
        return this.repo.getStaffByUserId(userId);
    }

    async getStaff(restaurantId: string, options: StaffListOptions = {}): Promise<StaffRow[]> {
        return this.repo.getStaff(restaurantId, options);
    }

    async createStaffMember(input: CreateStaffInput): Promise<StaffRow> {
        return this.repo.createStaffMember({
            restaurant_id: input.restaurantId,
            user_id: input.userId,
            name: input.name,
            email: input.email,
            role: input.role,
            pin_code: input.pinCode,
            phone: input.phone,
            is_active: true,
        });
    }

    async updateStaffMember(id: string, input: UpdateStaffInput): Promise<StaffRow> {
        return this.repo.updateStaffMember(id, {
            name: input.name,
            email: input.email,
            role: input.role,
            pin_code: input.pinCode,
            phone: input.phone,
            is_active: input.isActive,
        });
    }

    async deactivateStaffMember(id: string): Promise<StaffRow> {
        return this.repo.deactivateStaffMember(id);
    }
}

export const staffCrudService = new StaffCrudService();