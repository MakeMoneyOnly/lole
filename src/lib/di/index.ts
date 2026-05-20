/**
 * Dependency Injection module
 */

export { Container, token, type Token, type Registration } from './container';
export { container } from './container';

// Repository Container (DI Pattern)
export {
    RepositoryContainer,
    repositoryContainer,
    type IStaffRepository,
    type IPaymentsRepository,
} from './repository-container';