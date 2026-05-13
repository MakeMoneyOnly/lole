import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import type { Json } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

interface _CampaignRecord {
    id: string;
    restaurant_id: string;
    name: string;
    channel?: string;
    segment_id?: string | null;
    status?: string;
    launched_at?: string | null;
    created_at?: string;
    updated_at?: string;
}

const CampaignIdSchema = z.string().uuid();

const LaunchCampaignSchema = z.object({
    limit: z.coerce.number().int().min(1).max(2000).optional().default(500),
    dry_run: z.boolean().optional().default(false),
});

function normalizeSegmentRules(ruleJson: unknown) {
    if (!ruleJson || typeof ruleJson !== 'object') {
        return {
            tags_any: [] as string[],
            vip_only: false,
            minimum_visits: 0,
            language: null as string | null,
        };
    }

    const candidate = ruleJson as Record<string, unknown>;
    return {
        tags_any: Array.isArray(candidate.tags_any)
            ? candidate.tags_any
                  .filter(item => typeof item === 'string')
                  .map(item => item.trim())
                  .filter(Boolean)
            : [],
        vip_only: candidate.vip_only === true,
        minimum_visits:
            typeof candidate.minimum_visits === 'number' &&
            Number.isFinite(candidate.minimum_visits)
                ? Math.max(0, Math.floor(candidate.minimum_visits))
                : 0,
        language:
            typeof candidate.language === 'string' && candidate.language.length > 0
                ? candidate.language
                : null,
    };
}

export async function POST(
    request: Request,
    routeContext: { params: Promise<{ campaignId: string }> }
) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p2' });
    if (!context.ok) {
        return context.response;
    }

    const db = context.supabase as SupabaseClient<Database>;

    const { campaignId } = await routeContext.params;
    const campaignIdParsed = CampaignIdSchema.safeParse(campaignId);
    if (!campaignIdParsed.success) {
        return apiError(
            'Invalid campaign id',
            400,
            'INVALID_CAMPAIGN_ID',
            campaignIdParsed.error.flatten()
        );
    }

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const parsed = await parseJsonBody(request, LaunchCampaignSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { data: campaign, error: campaignError } = await db
        .from('campaigns')
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, channel, segment_id, status, launched_at, template_json, scheduled_at, created_by, created_at, updated_at'
        )
        .eq('id', campaignIdParsed.data)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle();

    if (campaignError) {
        return apiError(
            'Failed to load campaign',
            500,
            'CAMPAIGN_FETCH_FAILED',
            (campaignError as { message?: string })?.message ?? 'Unknown error'
        );
    }
    if (!campaign) {
        return apiError('Campaign not found', 404, 'CAMPAIGN_NOT_FOUND');
    }

    let segmentRules = {
        tags_any: [] as string[],
        vip_only: false,
        minimum_visits: 0,
        language: null as string | null,
    };

    if (campaign.segment_id) {
        const { data: segment, error: segmentError } = (await db
            .from('segments')
            .select('id, rule_json')
            .eq('id', campaign.segment_id)
            .eq('restaurant_id', context.restaurantId)
            .maybeSingle()) as { data: { id: string; rule_json: unknown } | null; error: unknown };

        if (segmentError) {
            return apiError(
                'Failed to load campaign segment',
                500,
                'SEGMENT_FETCH_FAILED',
                (segmentError as { message?: string })?.message ?? 'Unknown error'
            );
        }
        if (!segment) {
            return apiError('Campaign segment not found', 404, 'SEGMENT_NOT_FOUND');
        }

        segmentRules = normalizeSegmentRules(segment.rule_json);
    }

    const _guestFetchLimit = Math.min(parsed.data.limit * 4, 5000);

    // Use campaign service to get only verified recipients
    const { getVerifiedRecipients } = await import('@/lib/services/campaignService');

    const allGuests = await getVerifiedRecipients(context.restaurantId, {
        hasPhone:
            (campaign as { channel?: string }).channel === 'sms' ||
            (campaign as { channel?: string }).channel === 'whatsapp',
        hasEmail: (campaign as { channel?: string }).channel === 'email',
    });

    // Apply segment rules to filter verified guests
    const selectedGuests = allGuests
        .filter((guest: { isVerified?: boolean }) => {
            if (segmentRules.vip_only && !guest.isVerified) return false;
            // Note: segment rules for tags, visit_count etc would need additional data
            // For now, just use verified guests
            return true;
        })
        .slice(0, parsed.data.limit);

    if (parsed.data.dry_run) {
        return apiSuccess({
            campaign_id: campaign.id,
            eligible_guest_count: selectedGuests.length,
            launched: false,
            dry_run: true,
        });
    }

    if (selectedGuests.length > 0) {
        const { error: deliveryError } = await db.from('campaign_deliveries').upsert(
            selectedGuests.map((guest: { guestId: string }) => ({
                campaign_id: campaign.id,
                guest_id: guest.guestId,
                status: 'queued',
                metadata: {
                    source: 'campaign_launch',
                    idempotency_key: idempotencyKey,
                } as Json,
            })),
            { onConflict: 'campaign_id,guest_id' }
        );

        if (deliveryError) {
            return apiError(
                'Failed to queue campaign deliveries',
                500,
                'CAMPAIGN_DELIVERY_CREATE_FAILED',
                deliveryError.message
            );
        }
    }

    const nextStatus = selectedGuests.length > 0 ? 'running' : 'completed';

    const { data: updatedCampaign, error: updateError } = await db
        .from('campaigns')
        .update({
            status: nextStatus,
            launched_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', campaign.id)
        .eq('restaurant_id', context.restaurantId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, channel, segment_id, status, launched_at, template_json, scheduled_at, created_by, created_at, updated_at'
        )
        .single();

    if (updateError) {
        return apiError(
            'Failed to update campaign launch state',
            500,
            'CAMPAIGN_UPDATE_FAILED',
            (updateError as { message?: string })?.message ?? 'Unknown error'
        );
    }

    await writeAuditLog(context.supabase as SupabaseClient<Database>, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'campaign_launched',
        entity_type: 'campaign',
        entity_id: campaign.id,
        old_value: {
            status: (campaign as { status?: string }).status,
            launched_at: (campaign as { launched_at?: string | null }).launched_at,
        },
        new_value: {
            status: (updatedCampaign as { status?: string }).status,
            launched_at: (updatedCampaign as { launched_at?: string | null }).launched_at,
            queued_deliveries: selectedGuests.length,
        },
        metadata: {
            idempotency_key: idempotencyKey,
            segment_id: (campaign as { segment_id?: string | null }).segment_id,
        },
    });

    return apiSuccess({
        campaign: updatedCampaign,
        queued_deliveries: selectedGuests.length,
        idempotency_key: idempotencyKey,
        launched: true,
    });
}
