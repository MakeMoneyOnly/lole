// DI Bootstrap - Application Initialization
// Registers all domain containers and provides bootstrap function

import { container, Container } from './container';
import { registerStaffContainer } from '@/domains/staff/container';

// Track registration state
let isBootstrapped = false;

/**
 * Bootstrap the dependency injection container
 * Registers all domain containers and their dependencies
 */
export function bootstrapDI(): void {
    if (isBootstrapped) {
        return;
    }

    // Register domain containers in order of dependency
    registerStaffContainer();

    isBootstrapped = true;
}

/**
 * Check if DI has been bootstrapped
 */
export function isDIBootstrapped(): boolean {
    return isBootstrapped;
}

/**
 * Reset the DI container state
 * Useful for testing
 */
export function resetDI(): void {
    container.reset();
    isBootstrapped = false;
}

/**
 * Get the global container instance
 */
export function getContainer(): Container {
    return container;
}
