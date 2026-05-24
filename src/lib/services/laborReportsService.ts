/**
 * Labor Reports Service
 *
 * Provides comprehensive labor analytics and reporting for restaurant operations.
 * Includes time tracking, labor cost analysis, and scheduling insights.
 *
 * LOW-002: Configurable hourly rates per restaurant and role
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';

const log = logger.child('LaborReports');

// ============================================================================
// Types
// ============================================================================

/**
 * Hourly rate configuration for labor cost calculations
 * LOW-002: Made configurable per restaurant and role
 */
export interface HourlyRateConfig {
    /** Default hourly rate for the restaurant (in ETB) */
    defaultRate: number;
    /** Role-specific hourly rates (override default) */
    roleRates?: Record<string, number>;
    /** Staff-specific hourly rates (override role and default) */
    staffRates?: Record<string, number>;
}

/**
 * Default hourly rates by role in ETB
 * These are fallback values when restaurant hasn't configured custom rates
 */
export const DEFAULT_ROLE_HOURLY_RATES: Record<string, number> = {
    manager: 75,
    chef: 60,
    cook: 45,
    waiter: 35,
    waitress: 35,
    bartender: 40,
    cashier: 40,
    host: 35,
    hostess: 35,
    dishwasher: 30,
    cleaner: 30,
    delivery: 40,
    default: 50,
};

/**
 * Fetch hourly rate configuration for a restaurant
 * Uses the restaurants table's settings column for labor configuration
 */
export async function getHourlyRateConfig(
    supabase: SupabaseClient<Database>,
    restaurantId: string
): Promise<HourlyRateConfig> {
    try {
        // Try to fetch restaurant-specific rate configuration from restaurants table
        const { data: restaurant, error } = await supabase
            .from('restaurants')
            .select('settings')
            .eq('id', restaurantId)
            .single();

        if (error || !restaurant?.settings) {
            // Return default configuration
            return {
                defaultRate: DEFAULT_ROLE_HOURLY_RATES.default,
                roleRates: DEFAULT_ROLE_HOURLY_RATES,
            };
        }

        // Extract labor settings from restaurant settings JSONB column
        const settings = restaurant.settings as Record<string, unknown>;
        const laborSettings = (settings?.labor as Record<string, unknown>) || {};

        return {
            defaultRate:
                (laborSettings.defaultHourlyRate as number) ?? DEFAULT_ROLE_HOURLY_RATES.default,
            roleRates: {
                ...DEFAULT_ROLE_HOURLY_RATES,
                ...(laborSettings.roleHourlyRates as Record<string, number>),
            },
            staffRates: laborSettings.staffHourlyRates as Record<string, number>,
        };
    } catch {
        // Return default configuration on error
        return {
            defaultRate: DEFAULT_ROLE_HOURLY_RATES.default,
            roleRates: DEFAULT_ROLE_HOURLY_RATES,
        };
    }
}

/**
 * Get hourly rate for a specific staff member
 */
export function getStaffHourlyRate(
    staffId: string,
    role: string,
    config: HourlyRateConfig
): number {
    // 1. Check staff-specific rate (highest priority)
    if (config.staffRates?.[staffId] !== undefined) {
        return config.staffRates[staffId];
    }

    // 2. Check role-specific rate
    const normalizedRole = role.toLowerCase();
    if (config.roleRates?.[normalizedRole] !== undefined) {
        return config.roleRates[normalizedRole];
    }

    // 3. Fall back to default rate
    return config.defaultRate;
}

export interface LaborReportParams {
    restaurantId: string;
    startDate: string;
    endDate: string;
    groupBy?: 'day' | 'week' | 'month';
    /** Optional hourly rate configuration override */
    hourlyRateConfig?: HourlyRateConfig;
}

export interface TimeEntrySummary {
    staffId: string;
    staffName: string;
    role: string;
    totalHours: number;
    regularHours: number;
    overtimeHours: number;
    totalPay: number;
    hourlyRate: number;
    shiftsWorked: number;
    avgHoursPerShift: number;
}

export interface DailyLaborSummary {
    date: string;
    totalHours: number;
    totalPay: number;
    staffCount: number;
    scheduledHours: number;
    variance: number;
    laborCostPercent: number;
    sales: number;
}

export interface LaborReportData {
    summary: {
        totalHours: number;
        totalPay: number;
        avgHoursPerEmployee: number;
        laborCostPercent: number;
        overtimeHours: number;
        overtimePay: number;
        totalShifts: number;
        avgShiftLength: number;
    };
    byStaff: TimeEntrySummary[];
    byDay: DailyLaborSummary[];
    byRole: RoleLaborSummary[];
    insights: LaborInsight[];
}

export interface RoleLaborSummary {
    role: string;
    employeeCount: number;
    totalHours: number;
    totalPay: number;
    avgHourlyRate: number;
    percentOfTotal: number;
}

export interface LaborInsight {
    type: 'warning' | 'info' | 'success';
    title: string;
    description: string;
    metric?: number;
    recommendation?: string;
}

export interface LaborMetricTimeEntry {
    staff_id: string;
    clock_in_at: string;
    clock_out_at: string | null;
}

export interface LaborMetricSnapshot {
    totalHours: number;
    laborCost: number;
    laborCostPercent: number;
    tipsDistributed: number;
}

export function calculateLaborMetricsFromTimeEntries(input: {
    salesTotal: number;
    timeEntries: LaborMetricTimeEntry[];
    staffRoles: Record<string, string>;
    hourlyRateConfig: HourlyRateConfig;
    tipAllocations?: Array<{ total_tips_distributed?: number | null }>;
    rangeEndAt?: string;
}): LaborMetricSnapshot {
    const rangeEndAt = input.rangeEndAt ?? new Date().toISOString();
    const totalHours = input.timeEntries.reduce((sum, entry) => {
        const endAt = entry.clock_out_at ?? rangeEndAt;
        const hours =
            (new Date(endAt).getTime() - new Date(entry.clock_in_at).getTime()) / (1000 * 60 * 60);
        return sum + Math.max(0, hours);
    }, 0);

    const laborCost = input.timeEntries.reduce((sum, entry) => {
        const endAt = entry.clock_out_at ?? rangeEndAt;
        const hours =
            (new Date(endAt).getTime() - new Date(entry.clock_in_at).getTime()) / (1000 * 60 * 60);
        const rate = getStaffHourlyRate(
            entry.staff_id,
            input.staffRoles[entry.staff_id] ?? 'default',
            input.hourlyRateConfig
        );
        return sum + Math.max(0, hours) * rate;
    }, 0);

    const tipsDistributed = (input.tipAllocations ?? []).reduce(
        (sum, allocation) => sum + Number(allocation.total_tips_distributed ?? 0),
        0
    );

    const roundedLaborCost = Math.round(laborCost * 100) / 100;
    const roundedTotalHours = Math.round(totalHours * 100) / 100;
    const laborCostPercent =
        input.salesTotal > 0 ? Math.round((roundedLaborCost / input.salesTotal) * 10000) / 100 : 0;

    return {
        totalHours: roundedTotalHours,
        laborCost: roundedLaborCost,
        laborCostPercent,
        tipsDistributed: Math.round(tipsDistributed * 100) / 100,
    };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Generate comprehensive labor report
 */
export async function generateLaborReport(
    supabase: SupabaseClient<Database>,
    params: LaborReportParams
): Promise<{ data: LaborReportData | null; error: Error | null }> {
    try {
        const { restaurantId, startDate, endDate, groupBy = 'day' } = params;

        // Fetch staff with their roles
        const { data: staff, error: staffError } = await supabase
            .from('restaurant_staff')
            .select('id, full_name, role')
            .eq('restaurant_id', restaurantId);

        if (staffError) throw staffError;

        // Fetch orders for sales data
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('id, created_at, total_price')
            .eq('restaurant_id', restaurantId)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .neq('status', 'cancelled');

        if (ordersError) throw ordersError;

        // Calculate summaries based on order assignments (proxy for labor)
        const byStaff = calculateStaffSummaryFromOrders(staff || [], orders || []);
        const byDay = calculateDailySummaryFromOrders(
            (orders || []).map(o => ({
                created_at: o.created_at ?? '',
                total_price: o.total_price ?? undefined,
            })) as { created_at: string; total_price?: number | undefined }[],
            groupBy
        );
        const byRole = calculateRoleSummary(byStaff);
        const summary = calculateOverallSummary(byStaff, byDay);
        const insights = generateInsights(summary, byStaff, byDay);

        return {
            data: {
                summary,
                byStaff,
                byDay,
                byRole,
                insights,
            },
            error: null,
        };
    } catch (error) {
        log.error('Error generating labor report', error);
        return { data: null, error: error as Error };
    }
}

/**
 * Get labor cost percentage for a date range
 * LOW-002: Now uses configurable hourly rates
 */
export async function getLaborCostPercentage(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    startDate: string,
    endDate: string,
    hourlyRateConfig?: HourlyRateConfig
): Promise<{ data: number | null; error: Error | null }> {
    try {
        const [{ data: staff, error: staffError }, { data: timeEntries, error: timeEntriesError }] =
            await Promise.all([
                supabase
                    .from('restaurant_staff')
                    .select('id, role')
                    .eq('restaurant_id', restaurantId),
                supabase
                    .from('time_entries')
                    .select('staff_id, clock_in_at, clock_out_at')
                    .eq('restaurant_id', restaurantId)
                    .gte('clock_in_at', startDate)
                    .lte('clock_in_at', endDate),
            ]);

        if (staffError) throw staffError;
        if (timeEntriesError) throw timeEntriesError;

        // Get total sales
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('total_price')
            .eq('restaurant_id', restaurantId)
            .gte('created_at', startDate)
            .lte('created_at', endDate)
            .neq('status', 'cancelled');

        if (ordersError) throw ordersError;

        // Fetch hourly rate configuration if not provided
        const rateConfig = hourlyRateConfig ?? (await getHourlyRateConfig(supabase, restaurantId));

        const totalSales = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;
        const staffRoles = Object.fromEntries((staff ?? []).map(s => [s.id, s.role || 'default']));
        const metrics = calculateLaborMetricsFromTimeEntries({
            salesTotal: totalSales,
            timeEntries:
                (timeEntries ?? []).map(entry => ({
                    staff_id: entry.staff_id,
                    clock_in_at: entry.clock_in_at,
                    clock_out_at: entry.clock_out_at,
                })) ?? [],
            staffRoles,
            hourlyRateConfig: rateConfig,
            rangeEndAt: endDate,
        });

        return { data: metrics.laborCostPercent, error: null };
    } catch (error) {
        log.error('Error calculating labor cost percentage', error);
        return { data: null, error: error as Error };
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateStaffSummaryFromOrders(staff: any[], orders: any[]): TimeEntrySummary[] {
    const staffOrderMap = new Map<string, { orderCount: number; totalSales: number }>();

    // Initialize all staff
    for (const s of staff) {
        staffOrderMap.set(s.id, { orderCount: 0, totalSales: 0 });
    }

    // Count orders (assuming orders are assigned to staff in a real implementation)
    // For now, distribute orders evenly as a proxy
    const ordersPerStaff = Math.ceil(orders.length / Math.max(staff.length, 1));

    const summaries: TimeEntrySummary[] = [];
    const avgHourlyRate = 50; // ETB

    for (const s of staff) {
        const estimatedHours = ordersPerStaff * 0.25; // ~15 min per order
        const regularHours = Math.min(estimatedHours, 40);
        const overtimeHours = Math.max(0, estimatedHours - regularHours);
        const totalPay = regularHours * avgHourlyRate + overtimeHours * avgHourlyRate * 1.5;

        summaries.push({
            staffId: s.id,
            staffName: s.full_name || 'Unknown',
            role: s.role || 'staff',
            totalHours: Math.round(estimatedHours * 100) / 100,
            regularHours: Math.round(regularHours * 100) / 100,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            totalPay: Math.round(totalPay * 100) / 100,
            hourlyRate: avgHourlyRate,
            shiftsWorked: Math.ceil(estimatedHours / 8),
            avgHoursPerShift: 8,
        });
    }

    return summaries.sort((a, b) => b.totalHours - a.totalHours);
}

function calculateDailySummaryFromOrders(
    orders: Array<{ created_at: string; total_price?: number }>,
    _groupBy: 'day' | 'week' | 'month'
): DailyLaborSummary[] {
    const avgHourlyRate = 50;
    const dayMap = new Map<string, { orderCount: number; sales: number }>();

    for (const order of orders) {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        if (!dayMap.has(date)) {
            dayMap.set(date, { orderCount: 0, sales: 0 });
        }
        dayMap.get(date)!.orderCount++;
        dayMap.get(date)!.sales += order.total_price || 0;
    }

    const summaries: DailyLaborSummary[] = [];

    for (const [date, data] of dayMap) {
        const estimatedHours = data.orderCount * 0.5; // ~30 min per order
        const totalPay = estimatedHours * avgHourlyRate;
        const laborCostPercent = data.sales > 0 ? (totalPay / data.sales) * 100 : 0;

        summaries.push({
            date,
            totalHours: Math.round(estimatedHours * 100) / 100,
            totalPay: Math.round(totalPay * 100) / 100,
            staffCount: Math.ceil(estimatedHours / 8),
            scheduledHours: Math.round(estimatedHours * 100) / 100,
            variance: 0,
            laborCostPercent: Math.round(laborCostPercent * 100) / 100,
            sales: Math.round(data.sales * 100) / 100,
        });
    }

    return summaries.sort((a, b) => a.date.localeCompare(b.date));
}

function calculateRoleSummary(staffSummary: TimeEntrySummary[]): RoleLaborSummary[] {
    const roleMap = new Map<string, { count: number; hours: number; pay: number }>();
    const totalHours = staffSummary.reduce((sum, s) => sum + s.totalHours, 0);

    for (const staff of staffSummary) {
        if (!roleMap.has(staff.role)) {
            roleMap.set(staff.role, { count: 0, hours: 0, pay: 0 });
        }
        const role = roleMap.get(staff.role)!;
        role.count++;
        role.hours += staff.totalHours;
        role.pay += staff.totalPay;
    }

    const summaries: RoleLaborSummary[] = [];

    for (const [role, data] of roleMap) {
        summaries.push({
            role,
            employeeCount: data.count,
            totalHours: Math.round(data.hours * 100) / 100,
            totalPay: Math.round(data.pay * 100) / 100,
            avgHourlyRate: data.hours > 0 ? Math.round((data.pay / data.hours) * 100) / 100 : 0,
            percentOfTotal:
                totalHours > 0 ? Math.round((data.hours / totalHours) * 10000) / 100 : 0,
        });
    }

    return summaries.sort((a, b) => b.totalHours - a.totalHours);
}

function calculateOverallSummary(
    staffSummary: TimeEntrySummary[],
    dailySummary: DailyLaborSummary[]
): LaborReportData['summary'] {
    const totalHours = staffSummary.reduce((sum, s) => sum + s.totalHours, 0);
    const totalPay = staffSummary.reduce((sum, s) => sum + s.totalPay, 0);
    const overtimeHours = staffSummary.reduce((sum, s) => sum + s.overtimeHours, 0);
    const overtimePay = staffSummary.reduce(
        (sum, s) => sum + s.overtimeHours * s.hourlyRate * 0.5,
        0
    );
    const totalShifts = staffSummary.reduce((sum, s) => sum + s.shiftsWorked, 0);
    const totalSales = dailySummary.reduce((sum, d) => sum + d.sales, 0);

    return {
        totalHours: Math.round(totalHours * 100) / 100,
        totalPay: Math.round(totalPay * 100) / 100,
        avgHoursPerEmployee:
            staffSummary.length > 0
                ? Math.round((totalHours / staffSummary.length) * 100) / 100
                : 0,
        laborCostPercent: totalSales > 0 ? Math.round((totalPay / totalSales) * 10000) / 100 : 0,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        totalShifts,
        avgShiftLength: totalShifts > 0 ? Math.round((totalHours / totalShifts) * 100) / 100 : 0,
    };
}

function generateInsights(
    summary: LaborReportData['summary'],
    staffSummary: TimeEntrySummary[],
    _dailySummary: DailyLaborSummary[]
): LaborInsight[] {
    const insights: LaborInsight[] = [];

    // Labor cost insight
    if (summary.laborCostPercent > 35) {
        insights.push({
            type: 'warning',
            title: 'High Labor Cost',
            description: `Labor cost is ${summary.laborCostPercent}% of sales, which is above the recommended 30% threshold.`,
            metric: summary.laborCostPercent,
            recommendation:
                'Consider optimizing schedules or reviewing staffing levels during slow periods.',
        });
    } else if (summary.laborCostPercent < 20 && summary.laborCostPercent > 0) {
        insights.push({
            type: 'success',
            title: 'Efficient Labor Cost',
            description: `Labor cost is ${summary.laborCostPercent}% of sales, well within optimal range.`,
            metric: summary.laborCostPercent,
        });
    }

    // Overtime insight
    if (summary.overtimeHours > summary.totalHours * 0.1) {
        insights.push({
            type: 'warning',
            title: 'High Overtime',
            description: `${summary.overtimeHours} overtime hours (${Math.round((summary.overtimeHours / summary.totalHours) * 100)}% of total).`,
            metric: summary.overtimeHours,
            recommendation: 'Review scheduling to reduce overtime costs.',
        });
    }

    // Top performer
    if (staffSummary.length > 0) {
        const topPerformer = staffSummary[0];
        insights.push({
            type: 'info',
            title: 'Top Performer',
            description: `${topPerformer.staffName} worked ${topPerformer.totalHours} hours across ${topPerformer.shiftsWorked} shifts.`,
            metric: topPerformer.totalHours,
        });
    }

    return insights;
}
