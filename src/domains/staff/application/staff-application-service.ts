// Staff Domain - Application Layer
// Hexagonal architecture: Single entry point for staff operations from API routes
// Contains use cases that orchestrate domain services with proper validation and error handling

import { z } from 'zod';
import { logger } from '@/lib/logger';
import { staffService } from '../service';
import { StaffRow, StaffListOptions } from '../repository';
import type { CreateStaffInput, UpdateStaffInput } from '../crud-service';
import { STAFF_ROLES } from '@/types/status';

// ============================================================================
// Input/Output DTOs for Use Cases
// ============================================================================

export const GetStaffQuerySchema = z.object({
    restaurantId: z.string().uuid(),
    role: z.enum(STAFF_ROLES).optional(),
    isActive: z.coerce.boolean().optional(),
    limit: z.coerce.number().min(1).max(200).default(50).optional(),
    offset: z.coerce.number().min(0).default(0).optional(),
});

export type GetStaffQuery = z.infer<typeof GetStaffQuerySchema>;

export const GetStaffByIdQuerySchema = z.object({
    staffId: z.string().uuid(),
    restaurantId: z.string().uuid(),
});

export type GetStaffByIdQuery = z.infer<typeof GetStaffByIdQuerySchema>;

export const GetStaffByUserIdQuerySchema = z.object({
    userId: z.string().uuid(),
    restaurantId: z.string().uuid(),
});

export type GetStaffByUserIdQuery = z.infer<typeof GetStaffByUserIdQuerySchema>;

export const CreateStaffCommandSchema = z.object({
    restaurantId: z.string().uuid(),
    userId: z.string().uuid().optional(),
    name: z.string().min(1, 'Name is required').max(255),
    email: z.string().email().optional(),
    role: z.enum(STAFF_ROLES),
    pinCode: z.string().length(4, 'PIN must be 4 digits').optional(),
    phone: z.string().optional(),
});

export type CreateStaffCommand = z.infer<typeof CreateStaffCommandSchema>;

export const UpdateStaffCommandSchema = z.object({
    staffId: z.string().uuid(),
    restaurantId: z.string().uuid(),
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional(),
    role: z.enum(STAFF_ROLES).optional(),
    pinCode: z.string().length(4).optional(),
    phone: z.string().optional(),
    isActive: z.boolean().optional(),
});

export type UpdateStaffCommand = z.infer<typeof UpdateStaffCommandSchema>;

export const DeleteStaffCommandSchema = z.object({
    staffId: z.string().uuid(),
    restaurantId: z.string().uuid(),
});

export type DeleteStaffCommand = z.infer<typeof DeleteStaffCommandSchema>;

export const VerifyPinQuerySchema = z.object({
    staffId: z.string().uuid(),
    pinCode: z.string().length(4, 'PIN must be 4 digits'),
    restaurantId: z.string().uuid(),
});

export type VerifyPinQuery = z.infer<typeof VerifyPinQuerySchema>;

export const SetStaffActiveCommandSchema = z.object({
    staffId: z.string().uuid(),
    restaurantId: z.string().uuid(),
    isActive: z.boolean(),
});

export type SetStaffActiveCommand = z.infer<typeof SetStaffActiveCommandSchema>;

export const CheckPermissionQuerySchema = z.object({
    staff: z.object({
        role: z.string(),
    }),
    permission: z.string(),
});

export type CheckPermissionQuery = z.infer<typeof CheckPermissionQuerySchema>;

// ============================================================================
// Use Case Results
// ============================================================================

export interface UseCaseResult<T> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        code: string;
        details?: unknown;
    };
}

export interface StaffListResponse {
    staff: StaffRow[];
    total?: number;
}

// ============================================================================
// Validation Helpers
// ============================================================================

type ValidationResult<T> = 
    | { success: true; data: T }
    | { success: false; error: { message: string; code: string; details?: unknown } };

function validateDto<T>(schema: z.ZodSchema<T>, input: unknown): ValidationResult<T> {
    const result = schema.safeParse(input);
    if (!result.success) {
        return {
            success: false,
            error: {
                message: 'Invalid input',
                code: 'VALIDATION_ERROR',
                details: result.error.flatten(),
            },
        };
    }
    return { success: true, data: result.data };
}

// ============================================================================
// StaffApplicationService - Facade for all use cases
// ============================================================================

export class StaffApplicationService {
    // Get paginated staff list
    async getStaff(query: GetStaffQuery): Promise<UseCaseResult<StaffListResponse>> {
        const validation = validateDto(GetStaffQuerySchema, query);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<StaffListResponse>;
        }

        const validQuery = validation.data;

        try {
            const options: StaffListOptions = {
                role: validQuery.role,
                isActive: validQuery.isActive,
                limit: validQuery.limit,
                offset: validQuery.offset,
            };

            const staff = await staffService.getStaff(validQuery.restaurantId, options);

            return {
                success: true,
                data: { staff },
            };
        } catch (error) {
            logger.error('getStaff failed', error, {
                source: '[staff/application]',
                restaurantId: validQuery.restaurantId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to fetch staff',
                    code: 'STAFF_FETCH_FAILED',
                },
            };
        }
    }

    // Get single staff member by ID
    async getStaffById(query: GetStaffByIdQuery): Promise<UseCaseResult<StaffRow>> {
        const validation = validateDto(GetStaffByIdQuerySchema, query);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<StaffRow>;
        }

        const validQuery = validation.data;

        try {
            const staff = await staffService.getStaffMember(
                validQuery.staffId,
                validQuery.restaurantId
            );

            if (!staff) {
                return {
                    success: false,
                    error: {
                        message: 'Staff member not found',
                        code: 'STAFF_NOT_FOUND',
                    },
                };
            }

            return { success: true, data: staff };
        } catch (error) {
            logger.error('getStaffById failed', error, {
                source: '[staff/application]',
                staffId: validQuery.staffId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to fetch staff',
                    code: 'STAFF_FETCH_FAILED',
                },
            };
        }
    }

    // Get staff member by user ID
    async getStaffByUserId(query: GetStaffByUserIdQuery): Promise<UseCaseResult<StaffRow>> {
        const validation = validateDto(GetStaffByUserIdQuerySchema, query);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<StaffRow>;
        }

        const validQuery = validation.data;

        try {
            const staff = await staffService.getStaffByUserId(
                validQuery.userId,
                validQuery.restaurantId
            );

            if (!staff) {
                return {
                    success: false,
                    error: {
                        message: 'Staff member not found',
                        code: 'STAFF_NOT_FOUND',
                    },
                };
            }

            return { success: true, data: staff };
        } catch (error) {
            logger.error('getStaffByUserId failed', error, {
                source: '[staff/application]',
                userId: validQuery.userId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to fetch staff',
                    code: 'STAFF_FETCH_FAILED',
                },
            };
        }
    }

    // Create a new staff member
    async createStaff(command: CreateStaffCommand): Promise<UseCaseResult<StaffRow>> {
        const validation = validateDto(CreateStaffCommandSchema, command);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<StaffRow>;
        }

        const validCommand = validation.data;

        try {
            const input: CreateStaffInput = {
                restaurantId: validCommand.restaurantId,
                userId: validCommand.userId,
                name: validCommand.name,
                email: validCommand.email,
                role: validCommand.role,
                pinCode: validCommand.pinCode,
                phone: validCommand.phone,
            };

            const staff = await staffService.createStaffMember(input);

            logger.info('Staff member created', {
                staffId: staff.id,
                restaurantId: validCommand.restaurantId,
                role: validCommand.role,
            });

            return { success: true, data: staff };
        } catch (error) {
            logger.error('createStaff failed', error, {
                source: '[staff/application]',
                restaurantId: validCommand.restaurantId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to create staff',
                    code: 'STAFF_CREATE_FAILED',
                },
            };
        }
    }

    // Update an existing staff member
    async updateStaff(command: UpdateStaffCommand): Promise<UseCaseResult<StaffRow>> {
        const validation = validateDto(UpdateStaffCommandSchema, command);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<StaffRow>;
        }

        const validCommand = validation.data;

        try {
            const input: UpdateStaffInput = {
                name: validCommand.name,
                email: validCommand.email,
                role: validCommand.role,
                pinCode: validCommand.pinCode,
                phone: validCommand.phone,
                isActive: validCommand.isActive,
            };

            const staff = await staffService.updateStaffMember(
                validCommand.staffId,
                input,
                validCommand.restaurantId
            );

            logger.info('Staff member updated', {
                staffId: validCommand.staffId,
                restaurantId: validCommand.restaurantId,
            });

            return { success: true, data: staff };
        } catch (error) {
            logger.error('updateStaff failed', error, {
                source: '[staff/application]',
                staffId: validCommand.staffId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to update staff',
                    code: 'STAFF_UPDATE_FAILED',
                },
            };
        }
    }

    // Delete/deactivate a staff member
    async deleteStaff(command: DeleteStaffCommand): Promise<UseCaseResult<void>> {
        const validation = validateDto(DeleteStaffCommandSchema, command);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<void>;
        }

        const validCommand = validation.data;

        try {
            await staffService.deactivateStaffMember(
                validCommand.staffId,
                validCommand.restaurantId
            );

            logger.info('Staff member deactivated', {
                staffId: validCommand.staffId,
                restaurantId: validCommand.restaurantId,
            });

            return { success: true, data: undefined };
        } catch (error) {
            logger.error('deleteStaff failed', error, {
                source: '[staff/application]',
                staffId: validCommand.staffId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to delete staff',
                    code: 'STAFF_DELETE_FAILED',
                },
            };
        }
    }

    // Verify staff PIN
    async verifyPin(query: VerifyPinQuery): Promise<UseCaseResult<StaffRow>> {
        const validation = validateDto(VerifyPinQuerySchema, query);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<StaffRow>;
        }

        const validQuery = validation.data;

        try {
            const staff = await staffService.verifyPin(
                validQuery.staffId,
                validQuery.pinCode,
                validQuery.restaurantId
            );

            if (!staff) {
                return {
                    success: false,
                    error: {
                        message: 'Invalid PIN',
                        code: 'INVALID_PIN',
                    },
                };
            }

            return { success: true, data: staff };
        } catch (error) {
            logger.error('verifyPin failed', error, {
                source: '[staff/application]',
                staffId: validQuery.staffId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'PIN verification failed',
                    code: 'PIN_VERIFICATION_FAILED',
                },
            };
        }
    }

    // Set staff active status
    async setStaffActive(command: SetStaffActiveCommand): Promise<UseCaseResult<StaffRow>> {
        const validation = validateDto(SetStaffActiveCommandSchema, command);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<StaffRow>;
        }

        const validCommand = validation.data;

        try {
            const input: UpdateStaffInput = {
                isActive: validCommand.isActive,
            };

            const staff = await staffService.updateStaffMember(
                validCommand.staffId,
                input,
                validCommand.restaurantId
            );

            logger.info('Staff active status updated', {
                staffId: validCommand.staffId,
                restaurantId: validCommand.restaurantId,
                isActive: validCommand.isActive,
            });

            return { success: true, data: staff };
        } catch (error) {
            logger.error('setStaffActive failed', error, {
                source: '[staff/application]',
                staffId: validCommand.staffId,
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Failed to update staff status',
                    code: 'STAFF_STATUS_UPDATE_FAILED',
                },
            };
        }
    }

    // Check permission
    async checkPermission(query: CheckPermissionQuery): Promise<UseCaseResult<boolean>> {
        const validation = validateDto(CheckPermissionQuerySchema, query);
        if (!validation.success) {
            return { success: false, error: validation.error } as UseCaseResult<boolean>;
        }

        const validQuery = validation.data;

        try {
            const hasPermission = await staffService.hasPermission(
                validQuery.staff as StaffRow,
                validQuery.permission
            );

            return { success: true, data: hasPermission };
        } catch (error) {
            logger.error('checkPermission failed', error, {
                source: '[staff/application]',
            });
            return {
                success: false,
                error: {
                    message: error instanceof Error ? error.message : 'Permission check failed',
                    code: 'PERMISSION_CHECK_FAILED',
                },
            };
        }
    }
}

// Singleton instance for the application
export const staffApplicationService = new StaffApplicationService();