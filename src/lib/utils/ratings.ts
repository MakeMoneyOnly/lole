/**
 * Rating utilities for consistent rating generation
 *
 * Addresses: Duplicate Rating Calculation Logic (Medium Priority Audit Finding #10)
 * Locations:
 * - src/components/menu/DishCard.tsx
 * - src/components/menu/DishDetailModal.tsx
 */

/**
 * Generates a consistent rating from an item ID
 * Produces a deterministic rating between 4.0 and 4.9 based on the ID hash
 *
 * @param id - The item ID to generate a rating for
 * @param fallback - Fallback rating if id is empty/invalid (default: 4.5)
 * @returns A rating string formatted to 1 decimal place (e.g., "4.5")
 */
export function generateConsistentRating(
    id: string | undefined | null,
    fallback: number = 4.5
): string {
    if (!id) return fallback.toFixed(1);

    // Create a hash from the ID string
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // Generate rating between 4.0 and 4.9
    return (4.0 + (hash % 10) / 10).toFixed(1);
}

/**
 * Calculates average rating from an array of review ratings
 *
 * @param ratings - Array of individual ratings
 * @param fallback - Fallback rating if no ratings provided
 * @returns Average rating formatted to 1 decimal place
 */
export function calculateAverageRating(ratings: number[], fallback: number = 4.5): string {
    if (ratings.length === 0) return fallback.toFixed(1);

    const average = ratings.reduce((acc, rating) => acc + rating, 0) / ratings.length;
    return average.toFixed(1);
}

/**
 * Formats a rating for display with star icons
 * Returns the number of full stars and whether there's a half star
 *
 * @param rating - Rating string (e.g., "4.5")
 * @returns Object with fullStars count and hasHalfStar boolean
 */
export function formatRatingForDisplay(rating: string): {
    fullStars: number;
    hasHalfStar: boolean;
} {
    const numRating = parseFloat(rating);
    const fullStars = Math.floor(numRating);
    const hasHalfStar = numRating % 1 >= 0.5;

    return { fullStars, hasHalfStar };
}
