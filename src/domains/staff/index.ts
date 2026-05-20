/**
 * Staff domain exports
 * @module domains/staff
 */

// Re-export StaffRole from canonical source
export { STAFF_ROLES } from '@/types/status';
export type { StaffRole } from '@/types/status';

// Repository
export { StaffRepository, staffRepository } from './repository';
export type { StaffRow, StaffListOptions } from './repository';

// CRUD Service
export { StaffCrudService, staffCrudService } from './crud-service';

// Service
export { StaffService, staffService, isValidRole } from './service';
export type { CreateStaffInput, UpdateStaffInput } from './crud-service';

// Pin Service
export { PinService, pinService } from './pin-service';

// Role Service
export { RoleService, roleService } from './role-service';

// Permission Service
export { PermissionService, permissionService } from './permission-service';

// Application Layer
export {
    StaffApplicationService,
    staffApplicationService,
} from './application/staff-application-service';
export type {
    GetStaffQuery,
    GetStaffByIdQuery,
    GetStaffByUserIdQuery,
    CreateStaffCommand,
    UpdateStaffCommand,
    DeleteStaffCommand,
    VerifyPinQuery,
    SetStaffActiveCommand,
    CheckPermissionQuery,
    StaffListResponse,
    UseCaseResult,
} from './application/staff-application-service';

// Resolvers
export { staffResolvers } from './resolvers';
