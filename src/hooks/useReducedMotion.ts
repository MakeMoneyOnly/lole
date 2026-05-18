/**
 * useReducedMotion Hook
 *
 * Detects user's preference for reduced motion via the prefers-reduced-motion media query.
 * Use this hook to conditionally disable or reduce animations for users who prefer reduced motion.
 *
 * WCAG 2.1 Guideline 2.3.3 (AAA): Animation from Interactions
 * "Users should be able to disable animations that are triggered by interactions,
 * unless the animation is essential to the functionality or information being conveyed."
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = useReducedMotion();
 *
 * useEffect(() => {
 *   if (prefersReducedMotion) {
 *     // Skip or simplify animation
 *     return;
 *   }
 *   // Run full animation
 *   gsap.to(element, { opacity: 1, duration: 1 });
 * }, [prefersReducedMotion]);
 * ```
 */

import { useState, useEffect } from 'react';

// Media query for reduced motion preference
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Hook to detect if the user prefers reduced motion
 * @returns {boolean} true if user prefers reduced motion, false otherwise
 */
export function useReducedMotion(): boolean {
    // Default to false (no reduced motion) for SSR
    // This ensures animations run on first render, then adjust based on user preference
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        // Check if window is available (client-side)
        if (typeof window === 'undefined') {
            return;
        }

        const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);

        // Set initial value
        setPrefersReducedMotion(mediaQuery.matches);

        // Handler for changes
        const handleChange = (event: MediaQueryListEvent): React.JSX.Element => {
            setPrefersReducedMotion(event.matches);
        };

        // Add listener for changes
        // Modern browsers use addEventListener, older Safari uses addListener
        try {
            mediaQuery.addEventListener('change', handleChange);
        } catch {
            // Fallback for older browsers that don't support addEventListener
            mediaQuery.addListener(handleChange);
        }

        // Cleanup
        return () => {
            try {
                mediaQuery.removeEventListener('change', handleChange);
            } catch {
                mediaQuery.removeListener(handleChange);
            }
        };
    }, []);

    return prefersReducedMotion;
}

/**
 * Get reduced motion preference without React hook (for use in GSAP contexts)
 * @returns {boolean} true if user prefers reduced motion
 */
export function getReducedMotionPreference(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * GSAP-friendly animation wrapper that respects reduced motion
 * @param animation - Animation configuration or function
 * @param reducedMotionFallback - Optional fallback for reduced motion (e.g., instant opacity change)
 *
 * @example
 * ```tsx
 * // In a useEffect
 * const prefersReducedMotion = useReducedMotion();
 *
 * animateWithReducedMotion(
 *   prefersReducedMotion,
 *   () => gsap.to(element, { opacity: 1, duration: 1 }),
 *   () => gsap.set(element, { opacity: 1 }) // Instant for reduced motion
 * );
 * ```
 */
export function animateWithReducedMotion(
    prefersReducedMotion: boolean,
    animation: () => void,
    reducedMotionFallback?: () => void
): void {
    if (prefersReducedMotion) {
        if (reducedMotionFallback) {
            reducedMotionFallback();
        }
        // If no fallback provided, skip animation entirely
        return;
    }
    animation();
}

export default useReducedMotion;
