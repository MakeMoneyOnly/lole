/**
 * Scheduled Reports API Endpoint
 * TASK-REPORT-002: Scheduled Reports
 *
 * GET /api/reports/scheduled - List scheduled reports
 * POST /api/reports/scheduled - Create a scheduled report
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createScheduledReport, getScheduledReports } from '@/lib/services/scheduledReportsService';
import { logger } from '@/lib/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const log = logger.child('merchant-insights/reports/scheduled');

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            );
                        } catch {
                            // Ignore errors
                        }
                    },
                },
            }
        );

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        const { data: staffEntry, error: staffError } = await supabase
            .from('restaurant_staff')
            .select('restaurant_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

        if (staffError || !staffEntry) {
            return NextResponse.json(
                { error: { code: 'FORBIDDEN', message: 'Not a staff member' } },
                { status: 403 }
            );
        }

        const restaurantId = staffEntry.restaurant_id;
        const { searchParams } = new URL(request.url);
        const activeOnly = searchParams.get('activeOnly') === 'true';

        const reports = await getScheduledReports(supabase, restaurantId, { activeOnly });

        return NextResponse.json({
            data: reports,
        });
    } catch (error) {
        log.error('Error', error);
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            );
                        } catch {
                            // Ignore errors
                        }
                    },
                },
            }
        );

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        const { data: staffEntry, error: staffError } = await supabase
            .from('restaurant_staff')
            .select('restaurant_id, role')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

        if (staffError || !staffEntry) {
            return NextResponse.json(
                { error: { code: 'FORBIDDEN', message: 'Not a staff member' } },
                { status: 403 }
            );
        }

        const restaurantId = staffEntry.restaurant_id;

        // Check permission
        const allowedRoles = ['owner', 'admin', 'manager'];
        if (!allowedRoles.includes(staffEntry.role)) {
            return NextResponse.json(
                { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
                { status: 403 }
            );
        }

        const body = await request.json();

        // Validate required fields
        if (!body.name || !body.report_type || !body.recipient_emails?.length) {
            return NextResponse.json(
                {
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Name, report type, and recipient emails are required',
                    },
                },
                { status: 400 }
            );
        }

        const result = await createScheduledReport(
            supabase,
            restaurantId,
            {
                name: body.name,
                description: body.description,
                report_type: body.report_type,
                frequency: body.frequency ?? 'daily',
                run_at_time: body.run_at_time,
                timezone: body.timezone,
                day_of_week: body.day_of_week,
                day_of_month: body.day_of_month,
                date_range: body.date_range,
                custom_date_range_days: body.custom_date_range_days,
                filters: body.filters,
                format: body.format ?? 'pdf',
                include_charts: body.include_charts,
                include_comparison: body.include_comparison,
                delivery_method: body.delivery_method ?? 'email',
                recipient_emails: body.recipient_emails,
                email_subject: body.email_subject,
                email_body: body.email_body,
            },
            user.id
        );

        if (!result.success) {
            return NextResponse.json(
                { error: { code: 'CREATE_FAILED', message: result.error } },
                { status: 400 }
            );
        }

        // Log to audit
        await (supabase as SupabaseClient<Database>).from('audit_logs').insert({
            action: 'create_scheduled_report',
            entity_type: 'scheduled_report',
            entity_id: result.report?.id,
            restaurant_id: restaurantId,
            user_id: user.id,
            metadata: {
                report_name: body.name,
                report_type: body.report_type,
                frequency: body.frequency,
            },
        });

        return NextResponse.json({
            data: result.report,
        });
    } catch (error) {
        log.error('Error', error);
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
            { status: 500 }
        );
    }
}
