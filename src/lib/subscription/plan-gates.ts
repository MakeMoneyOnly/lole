/**
 * Plan Feature Gating Utility
 * Provides functions to check feature availability based on subscription plan
 */

import { PlanLevel, PlanFeatures, getPlanTier } from './plan-types';

/**
 * Check if a specific feature is available for the given plan
 *
 * @param plan - The restaurant's subscription plan
 * @param feature - The feature key to check
 * @returns true if the feature is available, false otherwise
 *
 * @example
 * ```typescript
 * checkFeature('free', 'analytics') // false
 * checkFeature('pro', 'analytics')  // true
 * checkFeature('enterprise', 'analytics') // true
 * ```
 */
export function checkFeature(plan: PlanLevel, feature: string): boolean {
    const features = PlanFeatures[plan];
    return features?.includes(feature) ?? false;
}

/**
 * Check if a feature is available and return an object with the result and required plan
 *
 * @param plan - The restaurant's subscription plan
 * @param feature - The feature key to check
 * @returns Object with availability status and the minimum plan required
 *
 * @example
 * ```typescript
 * getFeatureAccess('free', 'analytics')
 * // { available: false, requiredPlan: 'pro', currentPlan: 'free' }
 * ```
 */
export function getFeatureAccess(
    plan: PlanLevel,
    feature: string
): { available: boolean; requiredPlan: PlanLevel; currentPlan: PlanLevel } {
    const currentTier = getPlanTier(plan);

    // Find the minimum plan required for this feature
    let requiredPlan: PlanLevel = 'free';
    let foundFeature = false;

    for (const [tier, features] of Object.entries(PlanFeatures)) {
        if (features.includes(feature)) {
            requiredPlan = tier as PlanLevel;
            foundFeature = true;
            break;
        }
    }

    if (!foundFeature) {
        // Feature doesn't exist, allow access
        return { available: true, requiredPlan: 'free', currentPlan: plan };
    }

    const requiredTier = getPlanTier(requiredPlan);
    const available = currentTier >= requiredTier;

    return { available, requiredPlan, currentPlan: plan };
}

/**
 * Get all features available for a specific plan
 *
 * @param plan - The subscription plan
 * @returns Array of available feature keys
 *
 * @example
 * ```typescript
 * getPlanFeatures('pro') // ['basic_menu', 'analytics', 'inventory', ...]
 * ```
 */
export function getPlanFeatures(plan: PlanLevel): readonly string[] {
    return PlanFeatures[plan] ?? [];
}

/**
 * Get all features that are NOT available for a specific plan
 * This is useful for showing "upgrade to unlock" UI
 *
 * @param plan - The subscription plan
 * @returns Array of unavailable feature keys
 *
 * @example
 * ```typescript
 * getLockedFeatures('free') // ['analytics', 'inventory', 'channels', ...]
 * ```
 */
export function getLockedFeatures(plan: PlanLevel): string[] {
    const availableFeatures = new Set(PlanFeatures[plan] ?? []);
    const allFeatures = new Set(PlanFeatures['enterprise'] ?? []);

    const locked: string[] = [];
    for (const feature of allFeatures) {
        if (!availableFeatures.has(feature)) {
            locked.push(feature);
        }
    }

    return locked;
}

/**
 * Check if a plan upgrade is available from current plan
 *
 * @param currentPlan - The current subscription plan
 * @returns true if there's a higher tier available
 *
 * @example
 * ```typescript
 * canUpgrade('free')  // true
 * canUpgrade('pro')   // true
 * canUpgrade('enterprise') // false
 * ```
 */
export function canUpgrade(currentPlan: PlanLevel): boolean {
    return currentPlan !== 'enterprise';
}

/**
 * Get the upgrade message for a feature
 *
 * @param plan - The current subscription plan
 * @param feature - The feature key
 * @returns Message string for UI display
 *
 * @example
 * ```typescript
 * getUpgradeMessage('free', 'analytics')
 * // 'Upgrade to PRO to unlock Analytics Dashboard'
 * ```
 */
export function getUpgradeMessage(plan: PlanLevel, feature: string): string {
    const { available, requiredPlan } = getFeatureAccess(plan, feature);

    if (available) {
        return '';
    }

    const planLabel = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1);
    return `Upgrade to ${planLabel} to unlock this feature`;
}

/**
 * Validate that a plan value is valid
 *
 * @param plan - The plan value to validate
 * @returns true if valid plan, false otherwise
 *
 * @example
 * ```typescript
 * isValidPlan('free')   // true
 * isValidPlan('pro')    // true
 * isValidPlan('invalid') // false
 * ```
 */
export function isValidPlan(plan: string): plan is PlanLevel {
    return ['free', 'pro', 'enterprise'].includes(plan);
}
