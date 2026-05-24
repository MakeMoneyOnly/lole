/**
 * MED-002: Async Tenant Context Propagation
 *
 * Provides AsyncLocalStorage-based tenant context propagation for:
 * - Consistent tenant isolation across async operations
 * - Automatic tenant context in sync workers and background jobs
 * - Audit logging with proper tenant attribution
 *
 * Usage:
 * ```typescript
 * // In middleware or request handler
 * await tenantContext.run({ restaurantId, userId }, async () => {
 *   // All async operations within this scope have access to tenant context
 *   await processOrder();
 * });
 *
 * // In any async function within the scope
 * const ctx = tenantContext.getStore();
 * if (ctx?.restaurantId) {
 *   // Use tenant context
 * }
 * ```
 */

import { AsyncLocalStorage } from 'async_hooks';

/**
 * Tenant context interface
 */
export interface TenantContext {
    /** The restaurant ID for the current tenant */
    restaurantId: string;
    /** The user ID making the request */
    userId?: string;
    /** The staff ID if the user is a staff member */
    staffId?: string;
    /** The user's role within the restaurant */
    role?: string;
    /** Agency user ID if the user is an agency user accessing multiple restaurants */
    agencyUserId?: string;
    /** Request ID for tracing */
    requestId?: string;
    /** Timestamp when the context was created */
    createdAt: Date;
}

/**
 * AsyncLocalStorage instance for tenant context
 */
const tenantAsyncLocalStorage = new AsyncLocalStorage<TenantContext>();

/**
 * Tenant context manager using AsyncLocalStorage
 */
export const tenantContext = {
    /**
     * Run a function within a tenant context scope
     * All async operations within the callback will have access to this context
     */
    run<T>(context: Omit<TenantContext, 'createdAt'>, callback: () => Promise<T>): Promise<T> {
        const fullContext: TenantContext = {
            ...context,
            createdAt: new Date(),
        };
        return tenantAsyncLocalStorage.run(fullContext, callback);
    },

    /**
     * Run a synchronous function within a tenant context scope
     */
    runSync<T>(context: Omit<TenantContext, 'createdAt'>, callback: () => T): T {
        const fullContext: TenantContext = {
            ...context,
            createdAt: new Date(),
        };
        return tenantAsyncLocalStorage.run(fullContext, callback);
    },

    /**
     * Get the current tenant context
     * Returns undefined if called outside of a tenant context scope
     */
    getStore(): TenantContext | undefined {
        return tenantAsyncLocalStorage.getStore();
    },

    /**
     * Get the current restaurant ID
     * Throws an error if called outside of a tenant context scope
     */
    getRestaurantId(): string {
        const store = tenantAsyncLocalStorage.getStore();
        if (!store?.restaurantId) {
            throw new Error(
                'Tenant context not available. Ensure this code is running within a tenantContext.run() scope.'
            );
        }
        return store.restaurantId;
    },

    /**
     * Get the current restaurant ID or undefined if not in a context
     */
    getRestaurantIdSafe(): string | undefined {
        return tenantAsyncLocalStorage.getStore()?.restaurantId;
    },

    /**
     * Get the current user ID
     */
    getUserId(): string | undefined {
        return tenantAsyncLocalStorage.getStore()?.userId;
    },

    /**
     * Get the current staff ID
     */
    getStaffId(): string | undefined {
        return tenantAsyncLocalStorage.getStore()?.staffId;
    },

    /**
     * Get the current user's role
     */
    getRole(): string | undefined {
        return tenantAsyncLocalStorage.getStore()?.role;
    },

    /**
     * Check if the current user is an agency user
     */
    isAgencyUser(): boolean {
        return !!tenantAsyncLocalStorage.getStore()?.agencyUserId;
    },

    /**
     * Get the agency user ID if applicable
     */
    getAgencyUserId(): string | undefined {
        return tenantAsyncLocalStorage.getStore()?.agencyUserId;
    },

    /**
     * Get the request ID for tracing
     */
    getRequestId(): string | undefined {
        return tenantAsyncLocalStorage.getStore()?.requestId;
    },

    /**
     * Check if a tenant context is active
     */
    isActive(): boolean {
        return !!tenantAsyncLocalStorage.getStore();
    },

    /**
     * Update the current tenant context
     * Only works within an existing context scope
     */
    update(updates: Partial<TenantContext>): void {
        const store = tenantAsyncLocalStorage.getStore();
        if (store) {
            Object.assign(store, updates);
        }
    },

    /**
     * Create a child context with additional properties
     * Useful for nested operations that need additional context
     */
    createChild(additionalContext: Partial<TenantContext>): TenantContext | undefined {
        const parent = tenantAsyncLocalStorage.getStore();
        if (!parent) return undefined;
        return { ...parent, ...additionalContext };
    },
};

/**
 * Helper function to wrap an async function with tenant context
 * Useful for ensuring tenant context is propagated to background jobs
 */
export function withTenantContext<TArgs extends unknown[], TReturn>(
    context: Omit<TenantContext, 'createdAt'>,
    fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs) => {
        return tenantContext.run(context, () => fn(...args));
    };
}

/**
 * Helper to get tenant context for logging
 * Returns a safe object suitable for logging
 */
export function getTenantContextForLogging(): Record<string, unknown> {
    const store = tenantAsyncLocalStorage.getStore();
    if (!store) {
        return { tenantContext: 'not_available' };
    }
    return {
        restaurantId: store.restaurantId,
        userId: store.userId,
        staffId: store.staffId,
        role: store.role,
        agencyUserId: store.agencyUserId,
        requestId: store.requestId,
        contextAge: Date.now() - store.createdAt.getTime(),
    };
}

/**
 * Express/Next.js middleware helper to set tenant context
 */
export function createTenantContextMiddleware() {
    return async (
        req: { headers: Record<string, string | undefined> },
        res: unknown,
        next: () => Promise<void> | void
    ) => {
        const restaurantId = req.headers['x-restaurant-id'] as string | undefined;
        const userId = req.headers['x-user-id'] as string | undefined;
        const requestId = req.headers['x-request-id'] as string | undefined;

        if (restaurantId) {
            await tenantContext.run(
                {
                    restaurantId,
                    userId,
                    requestId,
                },
                async () => {
                    await next();
                }
            );
        } else {
            await next();
        }
    };
}

export default tenantContext;
