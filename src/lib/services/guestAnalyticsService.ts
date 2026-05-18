/**
 * Guest Analytics Service
 *
 * Provides comprehensive guest analytics and insights for restaurant operations.
 * Includes guest segmentation, visit patterns, and lifetime value analysis.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';

const log = logger.child('GuestAnalytics');

// ============================================================================
// Types
// ============================================================================

export interface GuestAnalyticsParams {
    restaurantId: string;
    startDate?: string;
    endDate?: string;
}

export interface GuestSegment {
    segment: 'new' | 'returning' | 'vip' | 'at_risk';
    count: number;
    percentOfTotal: number;
    avgSpend: number;
    avgVisits: number;
}

export interface GuestMetrics {
    totalGuests: number;
    newGuests: number;
    returningGuests: number;
    vipGuests: number;
    avgVisitsPerGuest: number;
    avgSpendPerGuest: number;
    avgSpendPerVisit: number;
    totalRevenue: number;
    retentionRate: number;
}

export interface VisitPattern {
    hour: number;
    dayOfWeek: number;
    visitCount: number;
    avgSpend: number;
}

export interface TopGuest {
    id: string;
    name: string;
    visitCount: number;
    totalSpend: number;
    avgSpendPerVisit: number;
    lastVisit: string;
    segment: string;
}

export interface GuestAnalyticsData {
    metrics: GuestMetrics;
    segments: GuestSegment[];
    visitPatterns: VisitPattern[];
    topGuests: TopGuest[];
    trends: GuestTrend[];
    insights: GuestInsight[];
}

export interface GuestTrend {
    date: string;
    newGuests: number;
    returningGuests: number;
    totalVisits: number;
    revenue: number;
}

export interface GuestInsight {
    type: 'warning' | 'info' | 'success';
    title: string;
    description: string;
    metric?: number;
    recommendation?: string;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Generate comprehensive guest analytics
 */
export async function generateGuestAnalytics(
    supabase: SupabaseClient<Database>,
    params: GuestAnalyticsParams
): Promise<{ data: GuestAnalyticsData | null; error: Error | null }> {
    try {
        const { restaurantId, startDate, endDate } = params;

        // Fetch guests with their order history
        const { data: guests, error: guestsError } = await supabase
            .from('guests')
            .select(
                `
                id,
                name,
                is_vip,
                created_at,
                orders:guest_visits (
                    id,
                    total_price:spend,
                    created_at
                )
            `
            )
            .eq('restaurant_id', restaurantId);

        if (guestsError) throw guestsError;

        // Fetch orders for patterns
        const { data: rawOrders, error: ordersError } = await supabase
            .from('guest_visits')
            .select('id, created_at, total_price:spend, guest_id')
            .eq('restaurant_id', restaurantId);

        if (ordersError) throw ordersError;
        const orders = rawOrders || [];

        // Calculate analytics
        const metrics = calculateMetrics(guests || [], orders, startDate, endDate);
        const segments = calculateSegments(guests || [], orders);
        const visitPatterns = calculateVisitPatterns(orders);
        const topGuests = calculateTopGuests(guests || []);
        const trends = calculateTrends(orders, startDate, endDate);
        const insights = generateInsights(metrics, segments, trends);

        return {
            data: {
                metrics,
                segments,
                visitPatterns,
                topGuests,
                trends,
                insights,
            },
            error: null,
        };
} catch (error) {
         log.error('Error generating guest analytics', error);
         return { data: null, error: error as Error };
     }
}

/**
 * Get guest retention rate
 */
export async function getGuestRetentionRate(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    months: number = 3
): Promise<{ data: number | null; error: Error | null }> {
    try {
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth() - months, 1);
        const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);

        // Get guests who visited in the first period
        const { data: firstPeriodOrders, error: firstError } = await supabase
            .from('guest_visits')
            .select('guest_id')
            .eq('restaurant_id', restaurantId)
            .gte('created_at', periodStart.toISOString())
            .lte('created_at', periodEnd.toISOString())
            .not('guest_id', 'is', null);

        if (firstError) throw firstError;

        const firstPeriodGuests = new Set(firstPeriodOrders?.map(o => o.guest_id) || []);

        // Check how many returned in the next period
        const nextPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const nextPeriodEnd = now;

        const { data: secondPeriodOrders, error: secondError } = await supabase
            .from('guest_visits')
            .select('guest_id')
            .eq('restaurant_id', restaurantId)
            .gte('created_at', nextPeriodStart.toISOString())
            .lte('created_at', nextPeriodEnd.toISOString())
            .not('guest_id', 'is', null);

        if (secondError) throw secondError;

        const secondPeriodGuests = new Set(secondPeriodOrders?.map(o => o.guest_id) || []);

        // Calculate retention
        let returningGuests = 0;
        for (const guestId of firstPeriodGuests) {
            if (secondPeriodGuests.has(guestId)) {
                returningGuests++;
            }
        }

        const retentionRate =
            firstPeriodGuests.size > 0 ? (returningGuests / firstPeriodGuests.size) * 100 : 0;

        return { data: Math.round(retentionRate * 100) / 100, error: null };
} catch (error) {
         log.error('Error calculating retention rate', error);
         return { data: null, error: error as Error };
     }
}

/**
 * Get guest lifetime value distribution
 */
export async function getGuestLifetimeValue(
    supabase: SupabaseClient<Database>,
    restaurantId: string
): Promise<{
    data: { avgLtv: number; medianLtv: number; topDecileLtv: number } | null;
    error: Error | null;
}> {
    try {
        const { data: guests, error } = await supabase
            .from('guests')
            .select(
                `
                id,
                orders:guest_visits (
                    total_price:spend
                )
            `
            )
            .eq('restaurant_id', restaurantId);

        if (error) throw error;

        const ltvValues: number[] = [];

        for (const guest of guests || []) {
            const totalSpend =
                (guest.orders as Array<{ total_price?: number }>)?.reduce(
                    (sum, o) => sum + (o.total_price || 0),
                    0
                ) || 0;
            ltvValues.push(totalSpend);
        }

        ltvValues.sort((a, b) => a - b);

        const avgLtv =
            ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;
        const medianLtv = ltvValues.length > 0 ? ltvValues[Math.floor(ltvValues.length / 2)] : 0;
        const topDecileLtv =
            ltvValues.length > 0 ? ltvValues[Math.floor(ltvValues.length * 0.9)] : 0;

        return {
            data: {
                avgLtv: Math.round(avgLtv * 100) / 100,
                medianLtv: Math.round(medianLtv * 100) / 100,
                topDecileLtv: Math.round(topDecileLtv * 100) / 100,
            },
            error: null,
        };
} catch (error) {
         log.error('Error calculating guest LTV', error);
         return { data: null, error: error as Error };
     }
}

// ============================================================================
// Helper Functions
// ============================================================================

interface GuestRow {
    id: string;
    name: string | null;
    is_vip: boolean;
    created_at: string;
    orders?: Array<{ total_price?: number; created_at: string }>;
}
interface OrderRow {
    guest_id: string | null;
    total_price?: number;
    created_at: string;
}
interface GuestRow {
    id: string;
    name: string | null;
    is_vip: boolean;
    created_at: string;
    orders?: Array<{ total_price?: number; created_at: string }>;
}
interface OrderRow {
    guest_id: string | null;
    total_price?: number;
    created_at: string;
}
function calculateMetrics(
    guests: GuestRow[],
    orders: OrderRow[],
    _startDate?: string,
    _endDate?: string
): GuestMetrics {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let newGuests = 0;
    let returningGuests = 0;
    let vipGuests = 0;
    let totalVisits = 0;
    let totalRevenue = 0;
    const guestVisitCounts = new Map<string, number>();
    const guestSpendCounts = new Map<string, number>();

    // Process orders
    for (const order of orders) {
        if (order.guest_id) {
            totalVisits++;
            totalRevenue += order.total_price || 0;
            guestVisitCounts.set(order.guest_id, (guestVisitCounts.get(order.guest_id) || 0) + 1);
            guestSpendCounts.set(
                order.guest_id,
                (guestSpendCounts.get(order.guest_id) || 0) + (order.total_price || 0)
            );
        }
    }

    // Process guests
    for (const guest of guests) {
        const visitCount = guestVisitCounts.get(guest.id) || 0;
        const isNew = new Date(guest.created_at) >= thirtyDaysAgo;

        if (isNew) newGuests++;
        if (visitCount > 1) returningGuests++;
        if (guest.is_vip) vipGuests++;
    }

    const totalGuests = guests.length;
    const avgVisitsPerGuest = totalGuests > 0 ? totalVisits / totalGuests : 0;
    const avgSpendPerGuest = totalGuests > 0 ? totalRevenue / totalGuests : 0;
    const avgSpendPerVisit = totalVisits > 0 ? totalRevenue / totalVisits : 0;

    // Calculate retention rate (guests with 2+ visits / total guests)
    const guestsWithMultipleVisits = Array.from(guestVisitCounts.values()).filter(
        c => c >= 2
    ).length;
    const retentionRate = totalGuests > 0 ? (guestsWithMultipleVisits / totalGuests) * 100 : 0;

    return {
        totalGuests,
        newGuests,
        returningGuests,
        vipGuests,
        avgVisitsPerGuest: Math.round(avgVisitsPerGuest * 100) / 100,
        avgSpendPerGuest: Math.round(avgSpendPerGuest * 100) / 100,
        avgSpendPerVisit: Math.round(avgSpendPerVisit * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        retentionRate: Math.round(retentionRate * 100) / 100,
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateSegments(guests: any[], orders: any[]): GuestSegment[] {
    const segments: Record<string, { count: number; spend: number; visits: number }> = {
        new: { count: 0, spend: 0, visits: 0 },
        returning: { count: 0, spend: 0, visits: 0 },
        vip: { count: 0, spend: 0, visits: 0 },
        at_risk: { count: 0, spend: 0, visits: 0 },
    };

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guestOrders = new Map<string, any[]>();
    for (const order of orders) {
        if (order.guest_id) {
            if (!guestOrders.has(order.guest_id)) {
                guestOrders.set(order.guest_id, []);
            }
            guestOrders.get(order.guest_id)!.push(order);
        }
    }

    for (const guest of guests) {
        const guestOrderList = guestOrders.get(guest.id) || [];
        const totalSpend = guestOrderList.reduce((sum, o) => sum + (o.total_price || 0), 0);
        const visitCount = guestOrderList.length;
        const lastOrderDate =
            guestOrderList.length > 0
                ? new Date(Math.max(...guestOrderList.map(o => new Date(o.created_at).getTime())))
                : null;

        // Determine segment
        if (guest.is_vip) {
            segments.vip.count++;
            segments.vip.spend += totalSpend;
            segments.vip.visits += visitCount;
        } else if (lastOrderDate && lastOrderDate < ninetyDaysAgo && visitCount > 0) {
            segments.at_risk.count++;
            segments.at_risk.spend += totalSpend;
            segments.at_risk.visits += visitCount;
        } else if (new Date(guest.created_at) >= thirtyDaysAgo) {
            segments.new.count++;
            segments.new.spend += totalSpend;
            segments.new.visits += visitCount;
        } else if (visitCount > 1) {
            segments.returning.count++;
            segments.returning.spend += totalSpend;
            segments.returning.visits += visitCount;
        } else {
            segments.new.count++;
            segments.new.spend += totalSpend;
            segments.new.visits += visitCount;
        }
    }

    const totalGuests = guests.length || 1;

    return Object.entries(segments).map(([segment, data]) => ({
        segment: segment as GuestSegment['segment'],
        count: data.count,
        percentOfTotal: Math.round((data.count / totalGuests) * 10000) / 100,
        avgSpend: data.count > 0 ? Math.round((data.spend / data.count) * 100) / 100 : 0,
        avgVisits: data.count > 0 ? Math.round((data.visits / data.count) * 100) / 100 : 0,
    }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateVisitPatterns(orders: any[]): VisitPattern[] {
    const patterns = new Map<string, { count: number; spend: number }>();

    for (const order of orders) {
        const date = new Date(order.created_at);
        const hour = date.getHours();
        const dayOfWeek = date.getDay();
        const key = `${hour}-${dayOfWeek}`;

        if (!patterns.has(key)) {
            patterns.set(key, { count: 0, spend: 0 });
        }
        patterns.get(key)!.count++;
        patterns.get(key)!.spend += order.total_price || 0;
    }

    const result: VisitPattern[] = [];

    for (let hour = 0; hour < 24; hour++) {
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const key = `${hour}-${dayOfWeek}`;
            const data = patterns.get(key) || { count: 0, spend: 0 };
            result.push({
                hour,
                dayOfWeek,
                visitCount: data.count,
                avgSpend: data.count > 0 ? Math.round((data.spend / data.count) * 100) / 100 : 0,
            });
        }
    }

    return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateTopGuests(guests: any[]): TopGuest[] {
    const guestData: TopGuest[] = [];

    for (const guest of guests) {
        const orders = (guest.orders as Array<{ total_price?: number; created_at: string }>) || [];
        const visitCount = orders.length;
        const totalSpend = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
        const lastVisit =
            orders.length > 0
                ? orders.sort(
                      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                  )[0].created_at
                : guest.created_at;

        let segment = 'new';
        if (guest.is_vip) segment = 'vip';
        else if (visitCount > 5) segment = 'returning';

        guestData.push({
            id: guest.id,
            name: guest.name || 'Unknown',
            visitCount,
            totalSpend: Math.round(totalSpend * 100) / 100,
            avgSpendPerVisit:
                visitCount > 0 ? Math.round((totalSpend / visitCount) * 100) / 100 : 0,
            lastVisit,
            segment,
        });
    }

    return guestData.sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateTrends(orders: any[], _startDate?: string, _endDate?: string): GuestTrend[] {
    const trends = new Map<
        string,
        {
            newGuests: Set<string>;
            returningGuests: Set<string>;
            totalVisits: number;
            revenue: number;
        }
    >();

    // Group by date
    for (const order of orders) {
        const date = new Date(order.created_at).toISOString().split('T')[0];
        if (!trends.has(date)) {
            trends.set(date, {
                newGuests: new Set(),
                returningGuests: new Set(),
                totalVisits: 0,
                revenue: 0,
            });
        }
        const data = trends.get(date)!;
        data.totalVisits++;
        data.revenue += order.total_price || 0;
        if (order.guest_id) {
            data.returningGuests.add(order.guest_id);
        }
    }

    return Array.from(trends.entries())
        .map(([date, data]) => ({
            date,
            newGuests: data.newGuests.size,
            returningGuests: data.returningGuests.size,
            totalVisits: data.totalVisits,
            revenue: Math.round(data.revenue * 100) / 100,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

function generateInsights(
    metrics: GuestMetrics,
    _segments: GuestSegment[],
    _trends: GuestTrend[]
): GuestInsight[] {
    const insights: GuestInsight[] = [];

    // Retention insight
    if (metrics.retentionRate < 20) {
        insights.push({
            type: 'warning',
            title: 'Low Guest Retention',
            description: `Only ${metrics.retentionRate}% of guests return for a second visit.`,
            metric: metrics.retentionRate,
            recommendation: 'Consider implementing a loyalty program to encourage repeat visits.',
        });
    } else if (metrics.retentionRate > 40) {
        insights.push({
            type: 'success',
            title: 'Strong Guest Retention',
            description: `${metrics.retentionRate}% of guests return for multiple visits.`,
            metric: metrics.retentionRate,
        });
    }

    // VIP segment insight
    const vipSegment = _segments.find((s: GuestSegment) => s.segment === 'vip');
    if (vipSegment && vipSegment.percentOfTotal < 5) {
        insights.push({
            type: 'info',
            title: 'VIP Opportunity',
            description: `Only ${vipSegment.percentOfTotal}% of guests are VIPs.`,
            metric: vipSegment.percentOfTotal,
            recommendation: 'Identify top spenders and offer VIP status to increase loyalty.',
        });
    }

    // At-risk segment insight
    const atRiskSegment = _segments.find((s: GuestSegment) => s.segment === 'at_risk');
    if (atRiskSegment && atRiskSegment.count > 0) {
        insights.push({
            type: 'warning',
            title: 'At-Risk Guests',
            description: `${atRiskSegment.count} guests haven't visited in 90+ days.`,
            metric: atRiskSegment.count,
            recommendation: 'Send a re-engagement campaign with a special offer.',
        });
    }

    // Average spend insight
    if (metrics.avgSpendPerVisit > 0) {
        insights.push({
            type: 'info',
            title: 'Average Spend Per Visit',
            description: `Guests spend an average of ${metrics.avgSpendPerVisit} ETB per visit.`,
            metric: metrics.avgSpendPerVisit,
        });
    }

    return insights;
}
