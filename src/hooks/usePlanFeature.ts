/**
 * usePlanFeature Hook
 * React hook for checking subscription plan feature availability
 */

import { useMemo } from 'react';
import {
    checkFeature,
    getFeatureAccess,
    getUpgradeMessage,
    getLockedFeatures,
    canUpgrade,
} from '@/lib/subscription/plan-gates';
import type { PlanLevel } from '@/lib/subscription/plan-types';

export interface UsePlanFeatureOptions {
    /** The feature key to check */
    feature: string;
    /** The current plan (from restaurant data) */
    plan: PlanLevel;
    /** If true, returns null when feature is unavailable (for conditional rendering) */
    returnNullOnLocked?: boolean;
}

export interface UsePlanFeatureResult {
    /** Whether the feature is available */
    isAvailable: boolean;
    /** The minimum plan required for this feature */
    requiredPlan: PlanLevel;
    /** Message to display when feature is locked */
    upgradeMessage: string;
    /** If feature is locked, this contains the feature key */
    lockedFeature?: string;
}

/**
 * Hook to check if a feature is available based on subscription plan
 *
 * @example
 * ```tsx
 * const { isAvailable, upgradeMessage } = usePlanFeature({
 *   feature: 'analytics',
 *   plan: restaurantPlan,
 * });
 *
 * if (!isAvailable) {
 *   return <UpgradePrompt message={upgradeMessage} />;
 * }
 * ```
 */
export function usePlanFeature({
    feature,
    plan,
    returnNullOnLocked = false,
}: UsePlanFeatureOptions): UsePlanFeatureResult {
    return useMemo(() => {
        const available = checkFeature(plan, feature);
        const { requiredPlan } = getFeatureAccess(plan, feature);
        const upgradeMessage = getUpgradeMessage(plan, feature);

        // If feature is available, return the result
        if (available) {
            return {
                isAvailable: true,
                requiredPlan,
                upgradeMessage: '',
            };
        }

        // If returnNullOnLocked is true, we still return the info but consumer can use isAvailable
        return {
            isAvailable: false,
            requiredPlan,
            upgradeMessage,
            lockedFeature: returnNullOnLocked ? undefined : feature,
        };
    }, [feature, plan, returnNullOnLocked]);
}

/**
 * Hook to check multiple features at once
 *
 * @example
 * ```tsx
 * const results = usePlanFeatures({
 *   features: ['analytics', 'inventory', 'channels'],
 *   plan: restaurantPlan,
 * });
 *
 * const allAvailable = results.every(r => r.isAvailable);
 * ```
 */
export function usePlanFeatures(options: {
    features: string[];
    plan: PlanLevel;
}): UsePlanFeatureResult[] {
    const { features, plan } = options;

    return useMemo(() => {
        return features.map(feature => ({
            ...usePlanFeature({ feature, plan, returnNullOnLocked: true }),
        }));
    }, [features, plan]);
}

/**
 * Hook to get all locked features for the current plan
 * Useful for showing "upgrade to unlock" UI with all locked features
 *
 * @example
 * ```tsx
 * const { lockedFeatures, canUpgrade } = usePlanLockedFeatures(restaurantPlan);
 *
 * return (
 *   <UpgradeCard>
 *     {lockedFeatures.map(f => <FeatureItem key={f} feature={f} />)}
 *     {canUpgrade && <UpgradeButton />}
 *   </UpgradeCard>
 * );
 * ```
 */
export function usePlanLockedFeatures(plan: PlanLevel): {
    /** Array of locked feature keys */
    lockedFeatures: string[];
    /** Whether upgrade to a higher plan is possible */
    canUpgrade: boolean;
} {
    return useMemo(() => {
        return {
            lockedFeatures: getLockedFeatures(plan),
            canUpgrade: canUpgrade(plan),
        };
    }, [plan]);
}

/**
 * Hook specifically for route protection
 * Returns a redirect path if feature is not available
 *
 * @example
 * ```tsx
 * // In a page component
 * const redirect = usePlanFeatureRedirect({
 *   feature: 'analytics',
 *   plan: restaurantPlan,
 * });
 *
 * if (redirect) {
 *   router.push(redirect);
 * }
 * ```
 */
export function usePlanFeatureRedirect(options: {
    feature: string;
    plan: PlanLevel;
}): string | null {
    const { feature, plan } = options;

    return useMemo(() => {
        const available = checkFeature(plan, feature);
        if (!available) {
            const { requiredPlan } = getFeatureAccess(plan, feature);
            return `/merchant/upgrade?feature=${feature}&required=${requiredPlan}`;
        }
        return null;
    }, [feature, plan]);
}
