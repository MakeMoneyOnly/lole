/**
 * Tip Pooling Calculation Utilities
 */

interface TipPoolShare {
    role: string;
    percentage: number;
}

interface _TipPool {
    id: string;
    restaurant_id: string;
    name: string;
    pool_type: 'percentage' | 'fixed_amount';
    pool_value: number;
    calculated_from: 'tips' | 'total';
    allocation_mode: 'shift' | 'daily' | 'weekly';
}

interface TipAllocationResult {
    role: string;
    amount: number;
    percentage: number;
}

/**
 * Calculate tip pool distribution based on shares
 */
export function calculateTipDistribution(
    totalTips: number,
    shares: TipPoolShare[]
): TipAllocationResult[] {
    const totalPercentage = shares.reduce((sum, s) => sum + s.percentage, 0);

    return shares.map(share => {
        // Calculate proportion of total percentage
        const proportion = totalPercentage > 0 ? share.percentage / totalPercentage : 0;
        const amount = Math.round(totalTips * proportion);

        return {
            role: share.role,
            amount,
            percentage: share.percentage,
        };
    });
}

/**
 * Calculate the pool amount from a bill total
 */
export function calculatePoolAmount(
    billTotal: number,
    poolType: 'percentage' | 'fixed_amount',
    poolValue: number,
    calculatedFrom: 'tips' | 'total'
): number {
    if (calculatedFrom === 'tips') {
        // If calculated from tips only, return the tip amount as-is
        // The actual tip amount would be passed separately
        return 0;
    }

    if (poolType === 'percentage') {
        return Math.round(billTotal * (poolValue / 10000));
    }

    return Math.min(poolValue, billTotal);
}

/**
 * Distribute tips among staff based on pool shares and hours worked
 */
export function distributeTipsByHours(
    tipAmount: number,
    shares: TipPoolShare[],
    hoursWorked: Record<string, number> // role -> hours
): TipAllocationResult[] {
    // Calculate weighted shares based on hours
    const totalWeightedShares = shares.reduce((sum, share) => {
        const hours = hoursWorked[share.role] || 0;
        return sum + share.percentage * hours;
    }, 0);

    if (totalWeightedShares === 0) {
        // Fall back to equal distribution
        const equalShare = Math.round(tipAmount / shares.length);
        return shares.map(share => ({
            role: share.role,
            amount: equalShare,
            percentage: share.percentage,
        }));
    }

    return shares.map(share => {
        const hours = hoursWorked[share.role] || 0;
        const weightedShare = (share.percentage * hours) / totalWeightedShares;
        const amount = Math.round(tipAmount * weightedShare);

        return {
            role: share.role,
            amount,
            percentage: share.percentage,
        };
    });
}
