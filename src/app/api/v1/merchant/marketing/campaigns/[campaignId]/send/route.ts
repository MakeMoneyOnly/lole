/**
 * Marketing Campaign Send API Endpoint
 * TASK-LOYALTY-001: Email/SMS Marketing Campaigns
 *
 * POST /api/campaigns/[campaignId]/send
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendCampaign, getCampaign } from '@/lib/services/marketingCampaignService';
import { logger } from '@/lib/logger';

const log = logger.child('[Campaign Send API]');

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ campaignId: string }> }
) {
    try {
        const { campaignId } = await params;
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

        // Get authenticated user
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

        // Get user's restaurant membership
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

        // Check permission - only managers can send campaigns
        const allowedRoles = ['owner', 'admin', 'manager'];
        if (!allowedRoles.includes(staffEntry.role)) {
            return NextResponse.json(
                { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
                { status: 403 }
            );
        }

        // Get campaign
        const campaign = await getCampaign(supabase, restaurantId, campaignId);
        if (!campaign) {
            return NextResponse.json(
                { error: { code: 'NOT_FOUND', message: 'Campaign not found' } },
                { status: 404 }
            );
        }

        // Parse request body for options
        const body = await request.json().catch(() => ({}));
        const testMode = body.testMode ?? false;
        const testEmail = body.testEmail;

        // Send campaign
        const result = await sendCampaign(supabase, restaurantId, campaignId, {
            testMode,
            testEmail,
            userId: user.id,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: { code: 'SEND_FAILED', message: result.error } },
                { status: 400 }
            );
        }

        // Log to audit
        await supabase.from('audit_logs').insert({
            action: 'send_marketing_campaign',
            entity_type: 'marketing_campaign',
            entity_id: campaignId,
            restaurant_id: restaurantId,
            user_id: user.id,
            metadata: {
                test_mode: testMode,
                recipients_count: result.recipientsCount ?? 0,
            },
        });

        return NextResponse.json({
            data: {
                campaignId,
                recipientsCount: result.recipientsCount ?? 0,
                testMode,
            },
        });
    } catch (error) {
        log.error('Error', error);
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
            { status: 500 }
        );
    }
}
