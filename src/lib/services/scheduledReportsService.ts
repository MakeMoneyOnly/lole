/**
 * Scheduled Reports Service
 * TASK-REPORT-002: Automatically generate and email reports
 *
 * Handles scheduled report generation and delivery.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';

const log = logger.child('ScheduledReports');

// =========================================================
// Type Definitions
// =========================================================

export type ReportType =
    | 'sales_summary'
    | 'item_performance'
    | 'labor_analysis'
    | 'payment_reconciliation'
    | 'guest_analytics'
    | 'loyalty_summary'
    | 'delivery_performance'
    | 'custom';

export type ReportFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';

export type ReportFormat = 'pdf' | 'csv' | 'xlsx' | 'json';

export type DateRange =
    | 'previous_day'
    | 'previous_week'
    | 'previous_month'
    | 'previous_quarter'
    | 'week_to_date'
    | 'month_to_date'
    | 'quarter_to_date'
    | 'year_to_date'
    | 'custom';

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed';

export interface ScheduledReport {
    id: string;
    restaurant_id: string;
    name: string;
    description: string | null;
    report_type: ReportType;
    frequency: ReportFrequency;
    run_at_time: string;
    timezone: string;
    day_of_week: number | null;
    day_of_month: number | null;
    date_range: DateRange;
    custom_date_range_days: number | null;
    filters: Record<string, unknown>;
    format: ReportFormat;
    include_charts: boolean;
    include_comparison: boolean;
    delivery_method: 'email' | 'download' | 'both';
    recipient_emails: string[];
    email_subject: string | null;
    email_body: string | null;
    is_active: boolean;
    last_run_at: string | null;
    last_run_status: 'success' | 'partial' | 'failed' | null;
    next_run_at: string | null;
    total_runs: number;
    successful_runs: number;
    failed_runs: number;
    created_at: string;
    created_by: string | null;
}

export interface ReportExecution {
    id: string;
    scheduled_report_id: string;
    restaurant_id: string;
    status: ExecutionStatus;
    started_at: string;
    completed_at: string | null;
    duration_ms: number | null;
    report_period_start: string | null;
    report_period_end: string | null;
    data_row_count: number | null;
    file_url: string | null;
    file_size_bytes: number | null;
    file_format: string | null;
    email_sent: boolean;
    email_sent_at: string | null;
    email_error: string | null;
    error_message: string | null;
}

export interface CreateScheduledReportInput {
    name: string;
    description?: string;
    report_type: ReportType;
    frequency: ReportFrequency;
    run_at_time?: string;
    timezone?: string;
    day_of_week?: number;
    day_of_month?: number;
    date_range?: DateRange;
    custom_date_range_days?: number;
    filters?: Record<string, unknown>;
    format?: ReportFormat;
    include_charts?: boolean;
    include_comparison?: boolean;
    delivery_method?: 'email' | 'download' | 'both';
    recipient_emails: string[];
    email_subject?: string;
    email_body?: string;
}

// =========================================================
// Scheduled Report CRUD
// =========================================================

/**
 * Create a scheduled report
 */
export async function createScheduledReport(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    input: CreateScheduledReportInput,
    userId: string
): Promise<{ success: true; report: ScheduledReport } | { success: false; error: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Calculate next run time
        const nextRunAt = calculateNextRunTime(
            input.frequency,
            input.run_at_time ?? '06:00:00',
            input.day_of_week ?? null,
            input.day_of_month ?? null,
            input.timezone ?? 'Africa/Addis_Ababa'
        );

        const { data, error } = await db
            .from('scheduled_reports')
            .insert({
                restaurant_id: restaurantId,
                name: input.name,
                description: input.description ?? null,
                report_type: input.report_type,
                frequency: input.frequency,
                run_at_time: input.run_at_time ?? '06:00:00',
                timezone: input.timezone ?? 'Africa/Addis_Ababa',
                day_of_week: input.day_of_week ?? null,
                day_of_month: input.day_of_month ?? null,
                date_range: input.date_range ?? 'previous_day',
                custom_date_range_days: input.custom_date_range_days ?? null,
                filters: input.filters ?? {},
                format: input.format ?? 'pdf',
                include_charts: input.include_charts ?? true,
                include_comparison: input.include_comparison ?? false,
                delivery_method: input.delivery_method ?? 'email',
                recipient_emails: input.recipient_emails,
                email_subject: input.email_subject ?? null,
                email_body: input.email_body ?? null,
                is_active: true,
                next_run_at: nextRunAt,
                created_by: userId,
            })
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, name, description, report_type, frequency, run_at_time, timezone, day_of_week, day_of_month, date_range, custom_date_range_days, filters, format, include_charts, include_comparison, delivery_method, recipient_emails, email_subject, email_body, is_active, last_run_at, last_run_status, next_run_at, total_runs, successful_runs, failed_runs, created_at, created_by'
            )
            .single();

        if (error) {
            return { success: false, error: 'Failed to create scheduled report' };
        }

        return { success: true, report: data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Get scheduled reports for a restaurant
 */
export async function getScheduledReports(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    options?: { activeOnly?: boolean }
): Promise<ScheduledReport[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    let query = db
        .from('scheduled_reports')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, description, report_type, frequency, run_at_time, timezone, day_of_week, day_of_month, date_range, custom_date_range_days, filters, format, include_charts, include_comparison, delivery_method, recipient_emails, email_subject, email_body, is_active, last_run_at, last_run_status, next_run_at, total_runs, successful_runs, failed_runs, created_at, created_by'
        )
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

    if (options?.activeOnly) {
        query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
        log.error('Failed to fetch scheduled reports', { error });
        return [];
    }

    return data ?? [];
}

/**
 * Update a scheduled report
 */
export async function updateScheduledReport(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    reportId: string,
    updates: Partial<CreateScheduledReportInput & { is_active: boolean }>
): Promise<{ success: boolean; report?: ScheduledReport; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        let nextRunAt: string | undefined;

        // Recalculate next run time if schedule changed
        if (
            updates.frequency ||
            updates.run_at_time ||
            updates.day_of_week ||
            updates.day_of_month
        ) {
            // HIGH-013: Explicit column selection
            const current = await db
                .from('scheduled_reports')
                .select('id, frequency, run_at_time, day_of_week, day_of_month, timezone')
                .eq('id', reportId)
                .single();

            if (current) {
                nextRunAt = calculateNextRunTime(
                    updates.frequency ?? current.frequency,
                    updates.run_at_time ?? current.run_at_time,
                    updates.day_of_week ?? current.day_of_week,
                    updates.day_of_month ?? current.day_of_month,
                    updates.timezone ?? current.timezone
                );
            }
        }

        const updateData: Record<string, unknown> = {
            ...updates,
            updated_at: new Date().toISOString(),
        };

        if (nextRunAt) {
            updateData.next_run_at = nextRunAt;
        }

        const { data, error } = await db
            .from('scheduled_reports')
            .update(updateData)
            .eq('id', reportId)
            .eq('restaurant_id', restaurantId)
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, name, description, report_type, frequency, run_at_time, timezone, day_of_week, day_of_month, date_range, custom_date_range_days, filters, format, include_charts, include_comparison, delivery_method, recipient_emails, email_subject, email_body, is_active, last_run_at, last_run_status, next_run_at, total_runs, successful_runs, failed_runs, created_at, created_by'
            )
            .single();

        if (error) {
            return { success: false, error: 'Failed to update report' };
        }

        return { success: true, report: data };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Delete a scheduled report
 */
export async function deleteScheduledReport(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    reportId: string
): Promise<{ success: boolean; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { error } = await db
        .from('scheduled_reports')
        .delete()
        .eq('id', reportId)
        .eq('restaurant_id', restaurantId);

    if (error) {
        return { success: false, error: 'Failed to delete report' };
    }

    return { success: true };
}

// =========================================================
// Report Execution
// =========================================================

/**
 * Get reports due for execution
 */
export async function getReportsDueForExecution(
    supabase: SupabaseClient<Database>
): Promise<ScheduledReport[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // HIGH-013: Explicit column selection
    const { data, error } = await db
        .from('scheduled_reports')
        .select(
            'id, restaurant_id, name, description, report_type, frequency, run_at_time, timezone, day_of_week, day_of_month, date_range, custom_date_range_days, filters, format, include_charts, include_comparison, delivery_method, recipient_emails, email_subject, email_body, is_active, last_run_at, last_run_status, next_run_at, total_runs, successful_runs, failed_runs, created_at, created_by'
        )
        .eq('is_active', true)
        .lte('next_run_at', new Date().toISOString());

    if (error) {
        log.error('Failed to fetch due reports', { error });
        return [];
    }

    return data ?? [];
}

/**
 * Execute a scheduled report
 */
export async function executeScheduledReport(
    supabase: SupabaseClient<Database>,
    reportId: string
): Promise<{ success: boolean; execution?: ReportExecution; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Create execution record
        const { data: execution, error: execError } = await db.rpc('create_report_execution', {
            p_scheduled_report_id: reportId,
        });

        if (execError || !execution?.success) {
            return { success: false, error: 'Failed to create execution' };
        }

        const executionId = execution.execution_id;

        // Get report configuration
        // HIGH-013: Explicit column selection
        const report = await db
            .from('scheduled_reports')
            .select(
                'id, restaurant_id, report_type, date_range, custom_date_range_days, filters, delivery_method, frequency, run_at_time, day_of_week, day_of_month, timezone, recipient_emails'
            )
            .eq('id', reportId)
            .single();

        if (!report) {
            await completeExecution(db, executionId, 'failed', null, null, 'Report not found');
            return { success: false, error: 'Report not found' };
        }

        // Calculate date range
        const { startDate, endDate } = getDateRange(
            report.date_range,
            report.custom_date_range_days
        );

        // Generate report data
        const reportData = await generateReportData(
            supabase,
            report.restaurant_id,
            report.report_type,
            startDate,
            endDate,
            report.filters
        );

        // In production, generate actual file (PDF/CSV/XLSX)
        // For now, we simulate success
        const fileUrl = `reports/${report.restaurant_id}/${reportId}/${executionId}.pdf`;
        const fileSize = JSON.stringify(reportData).length;

        // Complete execution
        await completeExecution(db, executionId, 'success', fileUrl, fileSize, null);

        // Send email if configured
        if (report.delivery_method === 'email' || report.delivery_method === 'both') {
            await sendReportEmail(db, report, fileUrl);
        }

        const executionResult = await getExecution(db, executionId);
        return { success: true, execution: executionResult ?? undefined };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Get execution history for a report
 */
export async function getExecutionHistory(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    reportId: string,
    limit: number = 10
): Promise<ReportExecution[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // HIGH-013: Explicit column selection
    const { data, error } = await db
        .from('report_executions')
        .select(
            'id, scheduled_report_id, restaurant_id, status, started_at, completed_at, duration_ms, report_period_start, report_period_end, data_row_count, file_url, file_size_bytes, file_format, email_sent, email_sent_at, email_error, error_message'
        )
        .eq('scheduled_report_id', reportId)
        .eq('restaurant_id', restaurantId)
        .order('started_at', { ascending: false })
        .limit(limit);

    if (error) {
        log.error('Failed to fetch execution history', { error });
        return [];
    }

    return data ?? [];
}

// =========================================================
// Helper Functions
// =========================================================

/**
 * Calculate next run time
 */
function calculateNextRunTime(
    frequency: ReportFrequency,
    runAtTime: string,
    dayOfWeek: number | null,
    dayOfMonth: number | null,
    _timezone: string = 'Africa/Addis_Ababa'
): string {
    const now = new Date();
    const [hours, minutes] = runAtTime.split(':').map(Number);

    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    switch (frequency) {
        case 'daily':
            if (nextRun <= now) {
                nextRun.setDate(nextRun.getDate() + 1);
            }
            break;

        case 'weekly':
            if (dayOfWeek !== null) {
                const currentDay = nextRun.getDay();
                const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
                nextRun.setDate(nextRun.getDate() + daysUntilTarget);
                if (nextRun <= now) {
                    nextRun.setDate(nextRun.getDate() + 7);
                }
            }
            break;

        case 'monthly':
            if (dayOfMonth !== null) {
                nextRun.setDate(Math.min(dayOfMonth, getDaysInMonth(nextRun)));
                if (nextRun <= now) {
                    nextRun.setMonth(nextRun.getMonth() + 1);
                    nextRun.setDate(Math.min(dayOfMonth, getDaysInMonth(nextRun)));
                }
            }
            break;

        case 'quarterly':
            // Run on first day of quarter
            const month = now.getMonth();
            const quarterStartMonth = Math.floor(month / 3) * 3;
            nextRun.setMonth(quarterStartMonth, 1);
            if (nextRun <= now) {
                nextRun.setMonth(nextRun.getMonth() + 3);
            }
            break;
    }

    return nextRun.toISOString();
}

function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function getDateRange(
    dateRange: DateRange,
    customDays: number | null
): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(now);
    startDate.setHours(0, 0, 0, 0);

    switch (dateRange) {
        case 'previous_day':
            startDate.setDate(startDate.getDate() - 1);
            endDate.setDate(endDate.getDate() - 1);
            break;

        case 'previous_week':
            startDate.setDate(startDate.getDate() - 7);
            break;

        case 'previous_month':
            startDate.setMonth(startDate.getMonth() - 1);
            break;

        case 'week_to_date':
            startDate.setDate(startDate.getDate() - startDate.getDay());
            break;

        case 'month_to_date':
            startDate.setDate(1);
            break;

        case 'custom':
            if (customDays) {
                startDate.setDate(startDate.getDate() - customDays);
            }
            break;
    }

    return { startDate, endDate };
}

async function generateReportData(
    supabase: SupabaseClient<Database>,
    restaurantId: string,
    reportType: ReportType,
    startDate: Date,
    endDate: Date,
    _filters: Record<string, unknown>
): Promise<Record<string, unknown>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    switch (reportType) {
        case 'sales_summary':
            const { data: orders } = await db
                .from('orders')
                .select('id, total_price, created_at, status')
                .eq('restaurant_id', restaurantId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());

            return {
                total_sales:
                    orders?.reduce(
                        (sum: number, o: { total_price?: number }) => sum + (o.total_price ?? 0),
                        0
                    ) ?? 0,
                order_count: orders?.length ?? 0,
                period_start: startDate,
                period_end: endDate,
            };

        case 'item_performance':
            const { data: orderItems } = await db
                .from('order_items')
                .select('name, quantity, price, menu_item_id')
                .eq('restaurant_id', restaurantId)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());

            return {
                items: orderItems ?? [],
                period_start: startDate,
                period_end: endDate,
            };

        default:
            return { period_start: startDate, period_end: endDate };
    }
}

async function completeExecution(
    db: SupabaseClient<Database>,
    executionId: string,
    status: 'success' | 'failed',
    fileUrl: string | null,
    fileSize: number | null,
    errorMessage: string | null
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).rpc('complete_report_execution', {
        p_execution_id: executionId,
        p_status: status,
        p_file_url: fileUrl,
        p_file_size_bytes: fileSize,
        p_error_message: errorMessage,
    });
}

async function sendReportEmail(
    db: SupabaseClient<Database>,
    report: ScheduledReport,
    _fileUrl: string
): Promise<void> {
    // In production, integrate with Resend/SendGrid
    log.warn('Would send email to recipients', { emails: report.recipient_emails });
}

async function getExecution(
    db: SupabaseClient<Database>,
    executionId: string
): Promise<ReportExecution | null> {
    // HIGH-013: Explicit column selection
    const { data } = await db
        .from('report_executions')
        .select(
            'id, scheduled_report_id, restaurant_id, status, started_at, completed_at, duration_ms, report_period_start, report_period_end, data_row_count, file_url, file_size_bytes, file_format, email_sent, email_sent_at, email_error, error_message'
        )
        .eq('id', executionId)
        .single();
    if (!data) return null;
    return {
        ...data,
        status: data.status as ExecutionStatus,
        email_sent: data.email_sent ?? false,
    };
}
