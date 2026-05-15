-- =========================================================
-- Email/SMS Marketing Campaigns
-- TASK-LOYALTY-001: Automated email and SMS marketing campaigns
-- =========================================================

-- Marketing campaigns table
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Campaign details
    name text NOT NULL,
    description text,
    campaign_type text NOT NULL CHECK (campaign_type IN (
        'win_back',
        'birthday',
        'new_guest',
        'loyalty_milestone',
        'promotional',
        'announcement',
        'custom'
    )),
    channel text NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
    
    -- Targeting
    target_segment_id uuid REFERENCES segments(id) ON DELETE SET NULL,
    target_criteria jsonb DEFAULT '{}', -- Custom targeting rules
    
    -- Content
    subject text, -- For email
    preheader text, -- Email preview text
    email_html text, -- HTML email body
    email_text text, -- Plain text email body
    sms_body text, -- SMS message (max 160 chars for standard SMS)
    
    -- Scheduling
    status text NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'
    )),
    scheduled_at timestamptz,
    sent_at timestamptz,
    
    -- Tracking
    total_recipients integer DEFAULT 0,
    emails_sent integer DEFAULT 0,
    emails_opened integer DEFAULT 0,
    emails_clicked integer DEFAULT 0,
    sms_sent integer DEFAULT 0,
    sms_delivered integer DEFAULT 0,
    
    -- Trigger settings
    is_automated boolean DEFAULT false,
    trigger_event text CHECK (trigger_event IN (
        'guest_birthday',
        'first_visit',
        'inactive_days',
        'loyalty_tier_upgrade',
        'visit_milestone',
        'manual'
    )),
    trigger_config jsonb DEFAULT '{}', -- e.g., {"inactive_days": 30}
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    
    CONSTRAINT valid_email_content CHECK (
        channel IN ('sms', 'both') OR (subject IS NOT NULL AND (email_html IS NOT NULL OR email_text IS NOT NULL))
    ),
    CONSTRAINT valid_sms_content CHECK (
        channel IN ('email') OR sms_body IS NOT NULL
    )
);

-- Campaign recipients (for tracking)
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    
    -- Delivery status
    status text NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed'
    )),
    
    -- Tracking
    sent_at timestamptz,
    delivered_at timestamptz,
    opened_at timestamptz,
    clicked_at timestamptz,
    bounce_reason text,
    
    -- External IDs for tracking
    email_message_id text, -- Provider message ID
    sms_message_id text,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Unique constraint
    UNIQUE(campaign_id, guest_id)
);

-- Email templates table
CREATE TABLE IF NOT EXISTS email_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    
    -- Template details
    name text NOT NULL,
    description text,
    template_type text NOT NULL CHECK (template_type IN (
        'win_back',
        'birthday',
        'new_guest',
        'promotional',
        'transactional',
        'custom'
    )),
    
    -- Content
    subject text NOT NULL,
    preheader text,
    html_content text NOT NULL,
    text_content text,
    
    -- Variables available in template
    available_variables text[] DEFAULT ARRAY['guest_name', 'restaurant_name', 'offer_details'],
    
    -- Status
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Unsubscribe tracking
CREATE TABLE IF NOT EXISTS guest_unsubscribes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    guest_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    
    -- Unsubscribe details
    unsubscribed_email boolean DEFAULT false,
    unsubscribed_sms boolean DEFAULT false,
    unsubscribe_reason text,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    
    -- Unique per guest per restaurant
    UNIQUE(restaurant_id, guest_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_restaurant ON marketing_campaigns(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_scheduled ON marketing_campaigns(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_automated ON marketing_campaigns(is_automated, trigger_event);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_guest ON campaign_recipients(guest_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON campaign_recipients(status);
CREATE INDEX IF NOT EXISTS idx_email_templates_restaurant ON email_templates(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_guest_unsubscribes_restaurant_guest ON guest_unsubscribes(restaurant_id, guest_id);

-- Enable RLS
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_unsubscribes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for marketing_campaigns
CREATE POLICY "staff_can_view_marketing_campaigns" ON marketing_campaigns
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "managers_can_manage_marketing_campaigns" ON marketing_campaigns
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'manager', 'admin', 'marketing')
        )
    );

-- RLS Policies for campaign_recipients
CREATE POLICY "staff_can_view_campaign_recipients" ON campaign_recipients
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- RLS Policies for email_templates
CREATE POLICY "staff_can_view_email_templates" ON email_templates
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "managers_can_manage_email_templates" ON email_templates
    FOR ALL
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
            AND role IN ('owner', 'manager', 'admin', 'marketing')
        )
    );

-- RLS Policies for guest_unsubscribes
CREATE POLICY "staff_can_view_unsubscribes" ON guest_unsubscribes
    FOR SELECT
    USING (
        restaurant_id IN (
            SELECT restaurant_id FROM restaurant_staff 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "guests_can_manage_own_unsubscribes" ON guest_unsubscribes
    FOR ALL
    USING (
        guest_id IN (
            SELECT id FROM guests WHERE user_id = auth.uid()
        )
    );

-- Function to check if guest is unsubscribed
CREATE OR REPLACE FUNCTION is_guest_unsubscribed(
    p_restaurant_id uuid,
    p_guest_id uuid,
    p_channel text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_unsubscribed boolean;
BEGIN
    SELECT 
        CASE 
            WHEN p_channel = 'email' THEN unsubscribed_email
            WHEN p_channel = 'sms' THEN unsubscribed_sms
            ELSE false
        END INTO v_unsubscribed
    FROM guest_unsubscribes
    WHERE restaurant_id = p_restaurant_id AND guest_id = p_guest_id;
    
    RETURN COALESCE(v_unsubscribed, false);
END;
$$;

-- Function to get campaign analytics
CREATE OR REPLACE FUNCTION get_campaign_analytics(
    p_campaign_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_campaign RECORD;
    v_stats RECORD;
BEGIN
    SELECT * INTO v_campaign FROM marketing_campaigns WHERE id = p_campaign_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'campaign_not_found');
    END IF;
    
    SELECT 
        COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered_count,
        COUNT(*) FILTER (WHERE status = 'opened') as opened_count,
        COUNT(*) FILTER (WHERE status = 'clicked') as clicked_count,
        COUNT(*) FILTER (WHERE status = 'bounced') as bounced_count,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_count
    INTO v_stats
    FROM campaign_recipients
    WHERE campaign_id = p_campaign_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'campaign_id', p_campaign_id,
        'total_recipients', v_campaign.total_recipients,
        'stats', jsonb_build_object(
            'sent', v_stats.sent_count,
            'delivered', v_stats.delivered_count,
            'opened', v_stats.opened_count,
            'clicked', v_stats.clicked_count,
            'bounced', v_stats.bounced_count,
            'failed', v_stats.failed_count
        ),
        'rates', jsonb_build_object(
            'open_rate', CASE WHEN v_stats.sent_count > 0 
                THEN ROUND((v_stats.opened_count::numeric / v_stats.sent_count) * 100, 2)
                ELSE 0 END,
            'click_rate', CASE WHEN v_stats.sent_count > 0 
                THEN ROUND((v_stats.clicked_count::numeric / v_stats.sent_count) * 100, 2)
                ELSE 0 END,
            'bounce_rate', CASE WHEN v_stats.sent_count > 0 
                THEN ROUND((v_stats.bounced_count::numeric / v_stats.sent_count) * 100, 2)
                ELSE 0 END
        )
    );
END;
$$;

-- Comments
COMMENT ON TABLE marketing_campaigns IS 'Marketing campaigns for email and SMS outreach';
COMMENT ON TABLE campaign_recipients IS 'Individual recipient tracking for campaigns';
COMMENT ON TABLE email_templates IS 'Reusable email templates for campaigns';
COMMENT ON TABLE guest_unsubscribes IS 'Guest unsubscribe preferences';