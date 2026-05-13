import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { generateMenuEngineeringReport } from '@/lib/services/menuEngineeringService';

const QuerySchema = z.object({
    period_start: z.string().datetime().optional(),
    period_end: z.string().datetime().optional(),
    category_id: z.string().uuid().optional(),
    format: z.enum(['json', 'csv']).default('json'),
});

/**
 * GET /api/reports/menu-engineering
 *
 * Generate a menu engineering report (Star/Dog/Puzzle/Plowhorse matrix).
 * Analyzes menu items by popularity and profitability.
 *
 * Query parameters:
 * - period_start: ISO datetime (optional, defaults to 30 days ago)
 * - period_end: ISO datetime (optional, defaults to now)
 * - category_id: Filter by menu category (optional)
 * - format: 'json' or 'csv' (default: json)
 */
export async function GET(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    // Parse query parameters
    const url = new URL(request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());
    const parsed = QuerySchema.safeParse(queryParams);

    if (!parsed.success) {
        return apiError(
            'Invalid query parameters',
            400,
            'VALIDATION_ERROR',
            parsed.error.flatten()
        );
    }

    const { period_start, period_end, category_id, format } = parsed.data;

    try {
        const report = await generateMenuEngineeringReport(context.supabase, {
            restaurantId: context.restaurantId,
            periodStart: period_start,
            periodEnd: period_end,
            categoryId: category_id,
        });

        // Return CSV format if requested
        if (format === 'csv') {
            const csvHeaders = [
                'Item Name',
                'Category',
                'Price (ETB)',
                'Cost (ETB)',
                'Profit Margin (ETB)',
                'Margin %',
                'Units Sold',
                'Revenue (ETB)',
                'Profit (ETB)',
                'Popularity Rank',
                'Profitability Rank',
                'Classification',
                'Recommendation',
            ].join(',');

            const csvRows = report.items.map(item =>
                [
                    `"${item.name.replace(/"/g, '""')}"`,
                    `"${item.category_name.replace(/"/g, '""')}"`,
                    item.price.toFixed(2),
                    item.cost.toFixed(2),
                    item.profit_margin.toFixed(2),
                    item.profit_margin_pct.toFixed(1),
                    item.total_sold,
                    item.total_revenue.toFixed(2),
                    item.total_profit.toFixed(2),
                    item.popularity_rank,
                    item.profitability_rank,
                    item.engineering_category.toUpperCase(),
                    `"${item.recommendation.replace(/"/g, '""')}"`,
                ].join(',')
            );

            const csv = [csvHeaders, ...csvRows].join('\n');

            return new Response(csv, {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="menu-engineering-${new Date().toISOString().split('T')[0]}.csv"`,
                },
            });
        }

        return apiSuccess(report);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return apiError(
            'Failed to generate menu engineering report',
            500,
            'REPORT_GENERATION_FAILED',
            errorMessage
        );
    }
}
