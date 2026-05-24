/**
 * Marketing Campaign Service
 * TASK-LOYALTY-001: Email/SMS Marketing Campaigns
 *
 * Implements automated email and SMS marketing campaigns
 * with templates, triggers, and analytics.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logger } from '@/lib/logger';

const log = logger.child('MarketingCampaign');

// =========================================================
// Type Definitions
// =========================================================

export type CampaignType =
    | 'win_back'
    | 'birthday'
    | 'new_guest'
    | 'loyalty_milestone'
    | 'promotional'
    | 'announcement'
    | 'custom';

export type CampaignChannel = 'email' | 'sms' | 'both';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled';

export type TriggerEvent =
    | 'guest_birthday'
    | 'first_visit'
    | 'inactive_days'
    | 'loyalty_tier_upgrade'
    | 'visit_milestone'
    | 'manual';

export interface MarketingCampaign {
    id: string;
    restaurant_id: string;
    name: string;
    description: string | null;
    campaign_type: CampaignType;
    channel: CampaignChannel;
    target_segment_id: string | null;
    target_criteria: Record<string, unknown>;
    subject: string | null;
    preheader: string | null;
    email_html: string | null;
    email_text: string | null;
    sms_body: string | null;
    status: CampaignStatus;
    scheduled_at: string | null;
    sent_at: string | null;
    total_recipients: number;
    emails_sent: number;
    emails_opened: number;
    emails_clicked: number;
    sms_sent: number;
    sms_delivered: number;
    is_automated: boolean;
    trigger_event: TriggerEvent | null;
    trigger_config: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    created_by: string | null;
}

export interface CampaignRecipient {
    id: string;
    campaign_id: string;
    restaurant_id: string;
    guest_id: string;
    status:
        | 'pending'
        | 'sent'
        | 'delivered'
        | 'opened'
        | 'clicked'
        | 'bounced'
        | 'failed'
        | 'unsubscribed';
    sent_at: string | null;
    delivered_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
    bounce_reason: string | null;
    email_message_id: string | null;
    sms_message_id: string | null;
}

export interface EmailTemplate {
    id: string;
    restaurant_id: string;
    name: string;
    description: string | null;
    template_type: string;
    subject: string;
    preheader: string | null;
    html_content: string;
    text_content: string | null;
    available_variables: string[];
    is_active: boolean;
    is_default: boolean;
    created_at: string;
    updated_at: string;
    created_by: string | null;
}

export interface CreateCampaignInput {
    name: string;
    description?: string;
    campaign_type: CampaignType;
    channel: CampaignChannel;
    target_segment_id?: string;
    target_criteria?: Record<string, unknown>;
    subject?: string;
    preheader?: string;
    email_html?: string;
    email_text?: string;
    sms_body?: string;
    scheduled_at?: string;
    is_automated?: boolean;
    trigger_event?: TriggerEvent;
    trigger_config?: Record<string, unknown>;
}

export interface CampaignAnalytics {
    campaign_id: string;
    total_recipients: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
    open_rate: number;
    click_rate: number;
    bounce_rate: number;
}

// Internal type for guest data with metadata
interface GuestWithMetadata {
    id: string;
    name: string | null;
    metadata: Record<string, unknown> | null;
}

// Internal type for unsubscribe data
interface UnsubscribeRecord {
    guest_id: string;
}

// Type for extended Supabase client with additional tables
type ExtendedSupabaseClient = SupabaseClient<Database>;

// =========================================================
// Campaign CRUD Operations
// =========================================================

/**
 * Create a new marketing campaign
 */
export async function createCampaign(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    input: CreateCampaignInput,
    userId: string
): Promise<{ success: true; campaign: MarketingCampaign } | { success: false; error: string }> {
    try {
        // Validate required fields based on channel
        if (input.channel !== 'sms' && !input.subject) {
            return { success: false, error: 'Email subject is required for email campaigns' };
        }

        if (input.channel !== 'email' && !input.sms_body) {
            return { success: false, error: 'SMS body is required for SMS campaigns' };
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated schema
        const { data: campaign, error } = await (supabase as any)
            .from('marketing_campaigns')
            .insert({
                restaurant_id: restaurantId,
                name: input.name,
                description: input.description ?? null,
                campaign_type: input.campaign_type,
                channel: input.channel,
                target_segment_id: input.target_segment_id ?? null,
                target_criteria: input.target_criteria ?? {},
                subject: input.subject ?? null,
                preheader: input.preheader ?? null,
                email_html: input.email_html ?? null,
                email_text: input.email_text ?? null,
                sms_body: input.sms_body ?? null,
                status: 'draft',
                scheduled_at: input.scheduled_at ?? null,
                is_automated: input.is_automated ?? false,
                trigger_event: input.trigger_event ?? null,
                trigger_config: input.trigger_config ?? {},
                created_by: userId,
            })
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, name, description, campaign_type, channel, target_segment_id, target_criteria, subject, preheader, email_html, email_text, sms_body, status, scheduled_at, sent_at, total_recipients, emails_sent, emails_opened, emails_clicked, sms_sent, sms_delivered, is_automated, trigger_event, trigger_config, created_at, updated_at, created_by'
            )
            .single();

        if (error) {
            log.error('Failed to create campaign', error);
            return { success: false, error: 'Failed to create campaign' };
        }

        return { success: true, campaign: campaign as unknown as MarketingCampaign };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Get campaigns for a restaurant
 */
export async function getCampaigns(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    options?: {
        status?: CampaignStatus;
        type?: CampaignType;
        limit?: number;
        offset?: number;
    }
): Promise<MarketingCampaign[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HIGH-013: Explicit column selection
    let query = (supabase as any)
        .from('marketing_campaigns')
        .select(
            'id, restaurant_id, name, description, campaign_type, channel, target_segment_id, target_criteria, subject, preheader, email_html, email_text, sms_body, status, scheduled_at, sent_at, total_recipients, emails_sent, emails_opened, emails_clicked, sms_sent, sms_delivered, is_automated, trigger_event, trigger_config, created_at, updated_at, created_by'
        )
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

    if (options?.status) {
        query = query.eq('status', options.status);
    }

    if (options?.type) {
        query = query.eq('campaign_type', options.type);
    }

    if (options?.limit) {
        query = query.limit(options.limit);
    }

    if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
        log.error('Failed to fetch campaigns', error);
        return [];
    }

    return (data ?? []) as MarketingCampaign[];
}

/**
 * Get a single campaign by ID
 */
export async function getCampaign(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    campaignId: string
): Promise<MarketingCampaign | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HIGH-013: Explicit column selection
    const { data, error } = await (supabase as any)
        .from('marketing_campaigns')
        .select(
            'id, restaurant_id, name, description, campaign_type, channel, target_segment_id, target_criteria, subject, preheader, email_html, email_text, sms_body, status, scheduled_at, sent_at, total_recipients, emails_sent, emails_opened, emails_clicked, sms_sent, sms_delivered, is_automated, trigger_event, trigger_config, created_at, updated_at, created_by'
        )
        .eq('id', campaignId)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    if (error) {
        log.error('Failed to fetch campaign', error);
        return null;
    }

    return data as MarketingCampaign | null;
}

/**
 * Update a campaign
 */
export async function updateCampaign(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    campaignId: string,
    updates: Partial<CreateCampaignInput & { status: CampaignStatus }>
): Promise<{ success: true; campaign: MarketingCampaign } | { success: false; error: string }> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: campaign, error } = await (supabase as any)
            .from('marketing_campaigns')
            .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
            .eq('id', campaignId)
            .eq('restaurant_id', restaurantId)
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, name, description, campaign_type, channel, target_segment_id, target_criteria, subject, preheader, email_html, email_text, sms_body, status, scheduled_at, sent_at, total_recipients, emails_sent, emails_opened, emails_clicked, sms_sent, sms_delivered, is_automated, trigger_event, trigger_config, created_at, updated_at, created_by'
            )
            .single();

        if (error) {
            return { success: false, error: 'Failed to update campaign' };
        }

        return { success: true, campaign: campaign as MarketingCampaign };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Delete a campaign
 */
export async function deleteCampaign(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    campaignId: string
): Promise<{ success: boolean; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from('marketing_campaigns')
        .delete()
        .eq('id', campaignId)
        .eq('restaurant_id', restaurantId);

    if (error) {
        return { success: false, error: 'Failed to delete campaign' };
    }

    return { success: true };
}

// =========================================================
// Campaign Execution
// =========================================================

/**
 * Get target guests for a campaign
 */
export async function getCampaignTargetGuests(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    campaign: MarketingCampaign
): Promise<Array<{ id: string; email: string | null; phone: string | null; name: string | null }>> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabase as any)
            .from('guests')
            .select('id, name, metadata')
            .eq('restaurant_id', restaurantId);

        // Apply targeting criteria
        const criteria = campaign.target_criteria as Record<string, unknown>;

        if (criteria?.inactive_days) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - (criteria.inactive_days as number));
            query = query.lt('last_seen_at', cutoffDate.toISOString());
        }

        if (criteria?.min_visits) {
            query = query.gte('visit_count', criteria.min_visits as number);
        }

        if (criteria?.min_lifetime_value) {
            query = query.gte('lifetime_value', criteria.min_lifetime_value as number);
        }

        // Filter out unsubscribed guests
        if (campaign.channel === 'email' || campaign.channel === 'both') {
            query = query.not('metadata->email', 'is', null);
        }

        const { data: guests, error } = await query.limit(10000);

        if (error) {
            log.error('Failed to get target guests', error);
            return [];
        }

        // Filter out unsubscribed
        const unsubscribedGuests = await getUnsubscribedGuests(supabase, restaurantId);
        const typedGuests = (guests ?? []) as GuestWithMetadata[];
        const filteredGuests = typedGuests.filter(g => !unsubscribedGuests.has(g.id));

        return filteredGuests.map(g => ({
            id: g.id,
            name: g.name,
            email: (g.metadata?.email as string | null) ?? null,
            phone: (g.metadata?.phone as string | null) ?? null,
        }));
    } catch (error) {
        log.error('Error getting target guests', error);
        return [];
    }
}

/**
 * Schedule a campaign for sending
 */
export async function scheduleCampaign(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    campaignId: string,
    scheduledAt: string
): Promise<{ success: boolean; error?: string }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from('marketing_campaigns')
        .update({
            status: 'scheduled',
            scheduled_at: scheduledAt,
            updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .eq('restaurant_id', restaurantId);

    if (error) {
        return { success: false, error: 'Failed to schedule campaign' };
    }

    return { success: true };
}

/**
 * Send a campaign immediately
 */
export async function sendCampaign(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    campaignId: string,
    _options?: {
        testMode?: boolean;
        testEmail?: string;
        userId?: string;
    }
): Promise<{
    success: boolean;
    recipientsCount?: number;
    emailsSent?: number;
    smsSent?: number;
    error?: string;
}> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    try {
        // Get campaign
        const campaign = await getCampaign(supabase, restaurantId, campaignId);
        if (!campaign) {
            return { success: false, error: 'Campaign not found' };
        }

        // Update status to sending
        await db.from('marketing_campaigns').update({ status: 'sending' }).eq('id', campaignId);

        // Get target guests
        const guests = await getCampaignTargetGuests(supabase, restaurantId, campaign);

        if (guests.length === 0) {
            await db
                .from('marketing_campaigns')
                .update({ status: 'sent', sent_at: new Date().toISOString() })
                .eq('id', campaignId);
            return { success: true, recipientsCount: 0 };
        }

        // Create recipient records
        const recipientRecords = guests.map(g => ({
            campaign_id: campaignId,
            restaurant_id: restaurantId,
            guest_id: g.id,
            status: 'pending' as const,
        }));

        await db.from('campaign_recipients').insert(recipientRecords);

        // Update campaign with recipient count
        await db
            .from('marketing_campaigns')
            .update({
                total_recipients: guests.length,
                status: 'sent',
                sent_at: new Date().toISOString(),
            })
            .eq('id', campaignId);

        // In production, this would trigger actual email/SMS sending
        // via Resend, SendGrid, or Africa's Talking

        return { success: true, recipientsCount: guests.length };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

// =========================================================
// Analytics
// =========================================================

/**
 * Get campaign analytics
 */
export async function getCampaignAnalytics(
    supabase: ExtendedSupabaseClient,
    _restaurantId: string,
    campaignId: string
): Promise<CampaignAnalytics | null> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc('get_campaign_analytics', {
            p_campaign_id: campaignId,
        });

        if (error) {
            log.error('Failed to get analytics', error);
            return null;
        }

        return data as CampaignAnalytics | null;
    } catch (error) {
        log.error('Error getting analytics', error);
        return null;
    }
}

/**
 * Track email open
 */
export async function trackEmailOpen(
    supabase: ExtendedSupabaseClient,
    recipientId: string
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
        .from('campaign_recipients')
        .update({
            status: 'opened',
            opened_at: new Date().toISOString(),
        })
        .eq('id', recipientId);
}

/**
 * Track email click
 */
export async function trackEmailClick(
    supabase: ExtendedSupabaseClient,
    recipientId: string
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
        .from('campaign_recipients')
        .update({
            status: 'clicked',
            clicked_at: new Date().toISOString(),
        })
        .eq('id', recipientId);
}

// =========================================================
// Unsubscribe Management
// =========================================================

/**
 * Get set of unsubscribed guest IDs
 */
async function getUnsubscribedGuests(
    supabase: ExtendedSupabaseClient,
    restaurantId: string
): Promise<Set<string>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from('guest_unsubscribes')
        .select('guest_id')
        .eq('restaurant_id', restaurantId);

    if (error || !data) {
        return new Set();
    }

    return new Set((data as UnsubscribeRecord[]).map(u => u.guest_id));
}

/**
 * Unsubscribe a guest from emails
 */
export async function unsubscribeGuestEmail(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    guestId: string,
    reason?: string
): Promise<{ success: boolean }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('guest_unsubscribes').upsert(
        {
            restaurant_id: restaurantId,
            guest_id: guestId,
            unsubscribed_email: true,
            unsubscribe_reason: reason ?? null,
        },
        { onConflict: 'restaurant_id, guest_id' }
    );

    return { success: true };
}

/**
 * Unsubscribe a guest from SMS
 */
export async function unsubscribeGuestSms(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    guestId: string,
    reason?: string
): Promise<{ success: boolean }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('guest_unsubscribes').upsert(
        {
            restaurant_id: restaurantId,
            guest_id: guestId,
            unsubscribed_sms: true,
            unsubscribe_reason: reason ?? null,
        },
        { onConflict: 'restaurant_id, guest_id' }
    );

    return { success: true };
}

// =========================================================
// Email Templates
// =========================================================

/**
 * Get email templates for a restaurant
 */
export async function getEmailTemplates(
    supabase: ExtendedSupabaseClient,
    restaurantId: string
): Promise<EmailTemplate[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- HIGH-013: Explicit column selection
    const { data, error } = await (supabase as any)
        .from('email_templates')
        .select(
            'id, restaurant_id, name, description, template_type, subject, preheader, html_content, text_content, available_variables, is_active, is_default, created_at, updated_at, created_by'
        )
        .or(`restaurant_id.eq.${restaurantId},is_system.eq.true`)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

    if (error) {
        log.error('Failed to fetch templates', error);
        return [];
    }

    return (data ?? []) as EmailTemplate[];
}

/**
 * Create an email template
 */
export async function createEmailTemplate(
    supabase: ExtendedSupabaseClient,
    restaurantId: string,
    template: {
        name: string;
        description?: string;
        template_type: string;
        subject: string;
        preheader?: string;
        html_content: string;
        text_content?: string;
        available_variables?: string[];
    },
    userId: string
): Promise<{ success: true; template: EmailTemplate } | { success: false; error: string }> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
            .from('email_templates')
            .insert({
                restaurant_id: restaurantId,
                name: template.name,
                description: template.description ?? null,
                template_type: template.template_type,
                subject: template.subject,
                preheader: template.preheader ?? null,
                html_content: template.html_content,
                text_content: template.text_content ?? null,
                available_variables: template.available_variables ?? [
                    'guest_name',
                    'restaurant_name',
                ],
                created_by: userId,
            })
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, name, description, template_type, subject, preheader, html_content, text_content, available_variables, is_active, is_default, created_at, updated_at, created_by'
            )
            .single();

        if (error) {
            return { success: false, error: 'Failed to create template' };
        }

        return { success: true, template: data as EmailTemplate };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Render template with variables
 */
export function renderTemplate(template: string, variables: Record<string, unknown>): string {
    let rendered = template;

    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
        rendered = rendered.replace(regex, String(value ?? ''));
    }

    return rendered;
}
