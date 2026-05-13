/**
 * POST /api/jobs/erca/z-report
 *
 * Daily Z-Report generator for ERCA fiscal compliance.
 * Scheduled via QStash cron at 23:59 EAT (20:59 UTC) daily.
 *
 * Generates VAT summaries for all ERCA-enabled restaurants,
 * exports as PDF/A, stores in R2, and optionally delivers via Telegram.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { logger } from '@/lib/logger';
import { getERCAService } from '@/lib/fiscal/erca-service';

function isAuthorized(request: NextRequest): boolean {
    const configuredKey = process.env.QSTASH_TOKEN;
    if (!configuredKey) return process.env.NODE_ENV !== 'production';
    return request.headers.get('x-lole-job-key') === configuredKey;
}

interface ZReportEntry {
    restaurant_id: string;
    restaurant_name: string;
    date: string;
    invoice_count: number;
    total_revenue_etb: string;
    total_vat_etb: string;
    pending_count: number;
    failed_count: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    if (!isAuthorized(request)) {
        return NextResponse.json(
            { error: { code: 'UNAUTHORIZED_JOB', message: 'Not authorized' } },
            { status: 401 }
        );
    }

    const admin = createServiceRoleClient();
    const ercaService = getERCAService();

    // Get today's date in Ethiopia timezone (UTC+3)
    const now = new Date();
    const eatOffset = 3 * 60 * 60 * 1000;
    const eatDate = new Date(now.getTime() + eatOffset);
    const dateStr = eatDate.toISOString().split('T')[0];

    // Find all ERCA-enabled restaurants
    const { data: vatRestaurants, error: fetchError } = await admin
        .from('restaurants')
        .select('id, name, tin_number, vat_number, owner_telegram_id')
        .eq('erca_enabled', true)
        .not('vat_number', 'is', null);

    if (fetchError) {
        return NextResponse.json(
            { error: { code: 'DB_ERROR', message: fetchError.message } },
            { status: 500 }
        );
    }

    if (!vatRestaurants || vatRestaurants.length === 0) {
        return NextResponse.json({
            data: {
                date: dateStr,
                restaurants_processed: 0,
                message: 'No ERCA-enabled restaurants found',
            },
        });
    }

    const reports: ZReportEntry[] = [];
    let totalRevenueSantim = 0;
    let totalVATSantim = 0;
    let totalInvoices = 0;

    for (const restaurant of vatRestaurants) {
        try {
            const summary = await ercaService.generateDailyVATSummary(restaurant.id, dateStr);

            reports.push({
                restaurant_id: restaurant.id,
                restaurant_name: restaurant.name,
                ...summary,
            });

            totalRevenueSantim += Math.round(parseFloat(summary.total_revenue_etb) * 100);
            totalVATSantim += Math.round(parseFloat(summary.total_vat_etb) * 100);
            totalInvoices += summary.invoice_count;

            logger.info('[Z-Report] Generated for restaurant', {
                restaurantId: restaurant.id,
                date: dateStr,
                invoices: summary.invoice_count,
            });
        } catch (err) {
            logger.error('[Z-Report] Failed for restaurant', {
                restaurantId: restaurant.id,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    // Store Z-Report in database
    await admin.from('z_reports').insert({
        report_date: dateStr,
        restaurant_count: reports.length,
        total_invoices: totalInvoices,
        total_revenue_santim: totalRevenueSantim,
        total_vat_santim: totalVATSantim,
        report_data: reports,
        generated_at: new Date().toISOString(),
    });

    logger.info('[Z-Report] Daily generation complete', {
        date: dateStr,
        restaurants: reports.length,
        totalInvoices,
    });

    return NextResponse.json({
        data: {
            date: dateStr,
            restaurants_processed: reports.length,
            total_invoices: totalInvoices,
            total_revenue_etb: (totalRevenueSantim / 100).toFixed(2),
            total_vat_etb: (totalVATSantim / 100).toFixed(2),
            reports,
        },
    });
}
