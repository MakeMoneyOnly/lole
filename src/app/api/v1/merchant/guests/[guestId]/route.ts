import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { redisRateLimiters } from '@/lib/security';
import type { NextRequest } from 'next/server';

const GuestIdSchema = z.string().uuid();

const UpdateGuestSchema = z
    .object({
        name: z.string().trim().min(1).max(140).optional(),
        language: z.enum(['en', 'am']).optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
        is_vip: z.boolean().optional(),
        notes: z.string().trim().max(1000).nullable().optional(),
    })
    .refine(value => Object.keys(value).length > 0, {
        message: 'At least one field is required',
    });

export async function GET(
    _request: Request,
    routeContext: { params: Promise<{ guestId: string }> }
) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const { guestId } = await routeContext.params;
    const guestIdParsed = GuestIdSchema.safeParse(guestId);
    if (!guestIdParsed.success) {
        return apiError('Invalid guest id', 400, 'INVALID_GUEST_ID', guestIdParsed.error.flatten());
    }

    const { data, error } = await context.supabase
        .from('guests')
        .select(
            'id, restaurant_id, name, phone_hash, email_hash, language, tags, is_vip, notes, first_seen_at, last_seen_at, visit_count, lifetime_value, created_at, updated_at'
        )
        .eq('id', guestIdParsed.data)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle();

    if (error) {
        return apiError('Failed to fetch guest', 500, 'GUEST_FETCH_FAILED', error.message);
    }
    if (!data) {
        return apiError('Guest not found', 404, 'GUEST_NOT_FOUND');
    }

    return apiSuccess(data);
}

export async function PATCH(
    request: Request,
    routeContext: { params: Promise<{ guestId: string }> }
) {
    // Apply rate limiting for guest mutations
    const rateLimitResponse = await redisRateLimiters.guestCreate(request as NextRequest);
    if (rateLimitResponse) {
        return rateLimitResponse;
    }

    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const { guestId } = await routeContext.params;
    const guestIdParsed = GuestIdSchema.safeParse(guestId);
    if (!guestIdParsed.success) {
        return apiError('Invalid guest id', 400, 'INVALID_GUEST_ID', guestIdParsed.error.flatten());
    }

    const parsed = await parseJsonBody(request, UpdateGuestSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const { data: existing, error: existingError } = await context.supabase
        .from('guests')
        .select('id, name, language, tags, is_vip, notes')
        .eq('id', guestIdParsed.data)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle();

    if (existingError) {
        return apiError('Failed to load guest', 500, 'GUEST_FETCH_FAILED', existingError.message);
    }
    if (!existing) {
        return apiError('Guest not found', 404, 'GUEST_NOT_FOUND');
    }

    const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };
    if (parsed.data.name !== undefined) {
        payload.name = parsed.data.name;
    }
    if (parsed.data.language !== undefined) {
        payload.language = parsed.data.language;
    }
    if (parsed.data.tags !== undefined) {
        payload.tags = parsed.data.tags;
    }
    if (parsed.data.is_vip !== undefined) {
        payload.is_vip = parsed.data.is_vip;
    }
    if (parsed.data.notes !== undefined) {
        payload.notes = parsed.data.notes;
    }

    const { data, error } = await context.supabase
        .from('guests')
        .update(payload)
        .eq('id', guestIdParsed.data)
        .eq('restaurant_id', context.restaurantId)
        .select(
            'id, restaurant_id, name, phone_hash, email_hash, language, tags, is_vip, notes, first_seen_at, last_seen_at, visit_count, lifetime_value, created_at, updated_at'
        )
        .single();

    if (error) {
        return apiError('Failed to update guest', 500, 'GUEST_UPDATE_FAILED', error.message);
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'guest_updated',
        entity_type: 'guest',
        entity_id: guestIdParsed.data,
        old_value: {
            name: existing.name,
            language: existing.language,
            tags: existing.tags,
            is_vip: existing.is_vip,
            notes: existing.notes,
        },
        new_value: {
            name: data.name,
            language: data.language,
            tags: data.tags,
            is_vip: data.is_vip,
            notes: data.notes,
        },
        metadata: { source: 'merchant_dashboard' },
    });

    return apiSuccess(data);
}
