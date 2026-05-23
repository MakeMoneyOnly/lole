/**
 * Dependency Injection module
 */

export { Container, token, type Token, type Registration } from './container';
export { container } from './container';

// Repository Container (DI Pattern)
export {
    RepositoryContainer,
    repositoryContainer,
    createRepositoryContainer,
    createStaffRepository,
    createPaymentsRepository,
    type IStaffRepository,
    type IPaymentsRepository,
} from './repository-container';

// Service Interfaces
export type {
    IPinService,
    IRoleService,
    IPermissionService,
    ICrudService,
    CreateStaffInput,
    UpdateStaffInput,
    StaffRole,
} from './interfaces';
