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

// Service
export { StaffService, staffService, isValidRole } from './service';
export type { CreateStaffInput, UpdateStaffInput } from './service';

// Resolvers
export { staffResolvers } from './resolvers';
