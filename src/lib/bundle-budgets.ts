/**
 * Bundle Size Budgets Configuration
 *
 * Defines maximum bundle size limits for different entry points.
 * Used with webpack-bundle-analyzer and CI checks to prevent
 * bundle bloat and ensure optimal loading performance.
 *
 * Budgets are based on Core Web Vitals recommendations:
 * - LCP target: < 2.5s
 * - First Bundle: < 170KB gzipped for mobile 3G (~120ms RTT, 1.6Mbps)
 * - Subsequent bundles: < 100KB gzipped each
 */

export const BUNDLE_BUDGETS = {
    // Main application bundle
    'main.js': {
        warning: 150 * 1024, // 150KB
        error: 200 * 1024, // 200KB
    },

    // Vendor/Polyfill bundle
    'vendor.js': {
        warning: 200 * 1024, // 200KB
        error: 300 * 1024, // 300KB
    },

    // Framework chunk (React, Next.js runtime)
    'framework-.+.js': {
        warning: 80 * 1024, // 80KB
        error: 120 * 1024, // 120KB
    },

    // Individual page chunks
    'pages/**/*.js': {
        warning: 100 * 1024, // 100KB per page
        error: 150 * 1024, // 150KB per page
    },

    // CSS bundle
    '**/*.css': {
        warning: 50 * 1024, // 50KB
        error: 100 * 1024, // 100KB
    },

    // Total initial bundle (all resources loaded for first paint)
    total: {
        warning: 300 * 1024, // 300KB
        error: 400 * 1024, // 400KB
    },
} as const;

/**
 * Budget check result interface
 */
export interface BudgetCheckResult {
    passed: boolean;
    file: string;
    size: number;
    budget: {
        warning: number;
        error: number;
    };
    exceeded: 'none' | 'warning' | 'error';
}

/**
 * Check a file against its budget
 * @param file - File name
 * @param size - Actual size in bytes
 * @returns BudgetCheckResult
 */
export function checkBudget(file: string, size: number): BudgetCheckResult {
    const budget = BUNDLE_BUDGETS[file as keyof typeof BUNDLE_BUDGETS] || BUNDLE_BUDGETS.total;

    let exceeded: 'none' | 'warning' | 'error' = 'none';

    if (size > budget.error) {
        exceeded = 'error';
    } else if (size > budget.warning) {
        exceeded = 'warning';
    }

    return {
        passed: exceeded !== 'error',
        file,
        size,
        budget,
        exceeded,
    };
}

/**
 * Format bytes to human readable string
 * @param bytes - Size in bytes
 * @returns Formatted string
 */
export function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Get bundle budget for a file name pattern
 * @param fileName - File name to match
 * @returns Budget configuration or default
 */
export function getBudget(fileName: string): { warning: number; error: number } {
    // Check exact match first
    if (fileName in BUNDLE_BUDGETS) {
        return BUNDLE_BUDGETS[fileName as keyof typeof BUNDLE_BUDGETS];
    }

    // Check patterns
    for (const [pattern, budget] of Object.entries(BUNDLE_BUDGETS)) {
        if (pattern.includes('*')) {
            // Convert glob to regex
            const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
            if (new RegExp(`^${regexPattern}$`).test(fileName)) {
                return budget;
            }
        }
    }

    // Return default total budget
    return BUNDLE_BUDGETS.total;
}

export default BUNDLE_BUDGETS;
