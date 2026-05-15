-- =========================================================
-- Scheduled Reports
-- TASK-REPORT-002: Automatically generate and email reports
-- =========================================================

-- Scheduled reports configuration
CREATE TABLE IF NOT EXISTS scheduled_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Report details
    name text NOT NULL,
    description text,
    report_type text NOT NULL CHECK (report_type IN (
        'sales_summary',
        'item_performance',
        'labor_analysis',
        'payment_reconciliation',
        'guest_analytics',
        'loyalty_summary',
        'delivery_performance',
        'custom'
    )),
    
    -- Schedule
    frequency text NOT NULL CHECK (frequency IN (
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'custom'
    )),
    custom_cron text, -- For custom schedules
    
    -- Time settings
    run_at_time time DEFAULT '06:00:00', -- Time of day to run
    timezone text DEFAULT 'Africa/Addis_Ababa',
    day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, for weekly
    day_of_month integer CHECK (day_of_month >= 1 AND day_of_month <= 31), -- For monthly
    
    -- Date range for report
    date_range text NOT NULL DEFAULT 'previous_day' CHECK (date_range IN (
        'previous_day',
        'previous_week',
        'previous_month',
        'previous_quarter',
        'week_to_date',
        'month_to_date',
        'quarter_to_date',
        'year_to_date',
        'custom'
    )),
    custom_date_range_days integer, -- For custom range
    
    -- Filters
    filters jsonb DEFAULT '{}', -- Additional filters (location, category, etc.)
    
    -- Output settings
    format text NOT NULL DEFAULT 'pdf' CHECK (format IN ('pdf', 'csv', 'xlsx', 'json')),
    include_charts boolean DEFAULT true,
    include_comparison boolean DEFAULT false, -- Compare to previous period
    
    -- Delivery
    delivery_method text NOT NULL DEFAULT 'email' CHECK (delivery_method IN ('email', 'download', 'both')),
    recipient_emails text[] NOT NULL DEFAULT '{}',
    email_subject text,
    email_body text,
    
    -- Status
    is_active boolean DEFAULT true,
    last_run_at timestamptz,
    last_run_status text CHECK (last_run_status IN ('success', 'partial', 'failed')),
    last_run_error text,
    next_run_at timestamptz,
    
    -- Tracking
    total_runs integer DEFAULT 0,
    successful_runs integer DEFAULT 0,
    failed_runs integer DEFAULT 0,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT valid_recipients CHECK (array_length(recipient_emails, 1) > 0 OR delivery_method = 'download')
);

-- Report execution history
CREATE TABLE IF NOT EXISTS report_executions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_report_id uuid NOT NULL REFERENCES scheduled_reports(id) ON DELETE CASCADE,
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Execution details
    status text NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
    started_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    duration_ms integer,
    
    -- Report data
    report_period_start date,
    report_period_end date,
    data_row_count integer,
    
    -- Output
    file_url text, -- URL to generated file in storage
    file_size_bytes bigint,
    file_format text,
    
    -- Delivery
    email_sent boolean DEFAULT false,
    email_sent_at timestamptz,
    email_error text,
    
    -- Error handling
    error_message text,
    error_stack text,
    
    -- Metadata
    metadata jsonb DEFAULT '{}'
);

-- Report templates (for custom reports)
CREATE TABLE IF NOT EXISTS report_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE, -- NULL for system templates
    
    -- Template details
    name text NOT NULL,
    description text,
    report_type text NOT NULL,
    
    -- Template configuration
    columns jsonb NOT NULL DEFAULT '[]', -- Array of column definitions
    filters jsonb DEFAULT '{}',
    group_by text[],
    order_by text[],
    
    -- SQL template (for custom reports)
    sql_template text,
    
    -- Chart configuration
    chart_config jsonb,
    
    -- Status
    is_active boolean DEFAULT true,
    is_system boolean DEFAULT false, -- System templates available to all
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_restaurant ON scheduled_reports(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_active ON scheduled_reports(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_report_executions_scheduled ON report_executions(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_restaurant ON report_executions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);
CREATE INDEX IF NOT EXISTS idx_report_templates_restaurant ON report_templates(restaurant_id);

-- Enable RLS
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "staff_can_view_scheduled_reports" ON scheduled_reports
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "managers_can_manage_scheduled_reports" ON scheduled_reports
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'manager', 'admin')
        )
    );

CREATE POLICY "staff_can_view_report_executions" ON report_executions
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "staff_can_view_report_templates" ON report_templates
    FOR SELECT
    USING (
        is_system = true OR
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Function to calculate next run time
CREATE OR REPLACE FUNCTION calculate_next_run_time(
    p_frequency text,
    p_run_at_time time,
    p_day_of_week integer DEFAULT NULL,
    p_day_of_month integer DEFAULT NULL,
    p_timezone text DEFAULT 'Africa/Addis_Ababa'
)
RETURNS timestamptz
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_run timestamptz;
    v_now timestamptz := now() AT TIME ZONE p_timezone;
    v_today date := v_now::date;
    v_run_today timestamptz;
BEGIN
    -- Calculate run time for today
    v_run_today := (v_today || ' ' || p_run_at_time)::timestamptz AT TIME ZONE p_timezone;
    
    CASE p_frequency
        WHEN 'daily' THEN
            -- Run daily at specified time
            IF v_run_today > v_now THEN
                v_next_run := v_run_today;
            ELSE
                v_next_run := v_run_today + interval '1 day';
            END IF;
            
        WHEN 'weekly' THEN
            -- Run on specified day of week
            v_next_run := v_run_today + 
                ((p_day_of_week - EXTRACT(DOW FROM v_today)::integer + 7) % 7) * interval '1 day';
            IF v_next_run <= v_now THEN
                v_next_run := v_next_run + interval '7 days';
            END IF;
            
        WHEN 'monthly' THEN
            -- Run on specified day of month
            v_next_run := make_date(
                EXTRACT(YEAR FROM v_today)::integer,
                EXTRACT(MONTH FROM v_today)::integer,
                LEAST(p_day_of_month, 
                    EXTRACT(DAY FROM (DATE_TRUNC('month', v_today) + interval '1 month - 1 day'))::integer)
            ) || ' ' || p_run_at_time;
            v_next_run := v_next_run AT TIME ZONE p_timezone;
            
            IF v_next_run <= v_now THEN
                -- Move to next month
                v_next_run := (DATE_TRUNC('month', v_next_run) + interval '1 month')::date +
                    LEAST(p_day_of_month - 1, 
                        EXTRACT(DAY FROM (DATE_TRUNC('month', v_next_run) + interval '2 months - 1 day'))::integer - 1
                    ) * interval '1 day' + p_run_at_time::time;
            END IF;
            
        ELSE
            -- Default to tomorrow
            v_next_run := v_run_today + interval '1 day';
    END CASE;
    
    RETURN v_next_run AT TIME ZONE 'UTC';
END;
$$;

-- Function to create report execution
CREATE OR REPLACE FUNCTION create_report_execution(
    p_scheduled_report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_report RECORD;
    v_execution_id uuid;
BEGIN
    SELECT * INTO v_report FROM scheduled_reports WHERE id = p_scheduled_report_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'report_not_found');
    END IF;
    
    INSERT INTO report_executions (
        scheduled_report_id,
        restaurant_id,
        status,
        started_at
    ) VALUES (
        p_scheduled_report_id,
        v_report.restaurant_id,
        'running',
        now()
    ) RETURNING id INTO v_execution_id;
    
    -- Update scheduled report
    UPDATE scheduled_reports
    SET last_run_at = now(),
        total_runs = total_runs + 1
    WHERE id = p_scheduled_report_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'execution_id', v_execution_id
    );
END;
$$;

-- Function to complete report execution
CREATE OR REPLACE FUNCTION complete_report_execution(
    p_execution_id uuid,
    p_status text,
    p_file_url text DEFAULT NULL,
    p_file_size_bytes bigint DEFAULT NULL,
    p_error_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_execution RECORD;
BEGIN
    SELECT * INTO v_execution FROM report_executions WHERE id = p_execution_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'execution_not_found');
    END IF;
    
    UPDATE report_executions
    SET status = p_status,
        completed_at = now(),
        duration_ms = EXTRACT(EPOCH FROM (now() - started_at)) * 1000,
        file_url = p_file_url,
        file_size_bytes = p_file_size_bytes,
        error_message = p_error_message
    WHERE id = p_execution_id;
    
    -- Update scheduled report stats
    UPDATE scheduled_reports
    SET last_run_status = p_status,
        successful_runs = successful_runs + CASE WHEN p_status = 'success' THEN 1 ELSE 0 END,
        failed_runs = failed_runs + CASE WHEN p_status = 'failed' THEN 1 ELSE 0 END,
        next_run_at = calculate_next_run_time(
            frequency, run_at_time, day_of_week, day_of_month, timezone
        )
    WHERE id = v_execution.scheduled_report_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Insert default report templates
INSERT INTO report_templates (name, description, report_type, columns, is_system, is_active)
VALUES
    ('Sales Summary', 'Daily sales breakdown by category and payment method', 'sales_summary',
     '[{"key": "date", "label": "Date", "type": "date"}, {"key": "total_sales", "label": "Total Sales", "type": "currency"}, {"key": "order_count", "label": "Orders", "type": "number"}, {"key": "avg_order_value", "label": "Avg Order", "type": "currency"}]'::jsonb,
     true, true),
    ('Item Performance', 'Top selling items with quantity and revenue', 'item_performance',
     '[{"key": "item_name", "label": "Item", "type": "text"}, {"key": "quantity", "label": "Qty", "type": "number"}, {"key": "revenue", "label": "Revenue", "type": "currency"}, {"key": "avg_price", "label": "Avg Price", "type": "currency"}]'::jsonb,
     true, true),
    ('Labor Analysis', 'Staff hours and labor cost breakdown', 'labor_analysis',
     '[{"key": "staff_name", "label": "Staff", "type": "text"}, {"key": "hours_worked", "label": "Hours", "type": "number"}, {"key": "labor_cost", "label": "Cost", "type": "currency"}]'::jsonb,
     true, true)
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE scheduled_reports IS 'Configuration for automated report generation and delivery';
COMMENT ON TABLE report_executions IS 'History of report execution runs';
COMMENT ON TABLE report_templates IS 'Reusable report templates';
COMMENT ON FUNCTION calculate_next_run_time IS 'Calculates the next run time based on schedule configuration';