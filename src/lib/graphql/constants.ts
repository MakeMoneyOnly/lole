/**
 * GraphQL Constants
 * Shared constants for GraphQL resolvers and validation
 */

/**
 * Pagination limits to prevent unbounded result sets and memory exhaustion.
 * These limits are enforced at the resolver level.
 */
export const PAGINATION = {
    /** Maximum number of items that can be requested in a single page */
    MAX_PAGE_SIZE: 100,
    /** Default number of items returned when no limit is specified */
    DEFAULT_PAGE_SIZE: 20,
} as const;

/**
 * Helper function to enforce pagination limits
 * @param requestedLimit - The limit requested by the client (optional)
 * @returns The enforced limit capped at MAX_PAGE_SIZE
 */
export function enforcePaginationLimit(requestedLimit?: number): number {
    return Math.min(requestedLimit ?? PAGINATION.DEFAULT_PAGE_SIZE, PAGINATION.MAX_PAGE_SIZE);
}
