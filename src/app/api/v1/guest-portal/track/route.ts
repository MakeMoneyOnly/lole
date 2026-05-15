/**
 * GET /api/v1/guest-portal/track?slug=...&order_id=...&sig=...&exp=...&table=...
 *
 * Public guest order tracker endpoint.
 * - Uses the SERVICE ROLE client so RLS is bypassed for unauthenticated guests.
 * - Performs HMAC verification inline (same logic as verifySignedQRCode) so
 *   we don't need a user session to look up the restaurant/table.
 * - Returns the order + kds_order_items so guests can track live prep status.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { verifySignedQRCode } from '@/lib/security/hmac';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { logger } from '@/lib/logger';

const log = logger.child('[guest-portal/track]');

const TrackQuerySchema = z.object({
    slug: z.string().min(1).max(128),
    order_id: z.string().uuid(),
    // sig: 64 hex chars — accept any length as-is; verifySignedQRCode handles validation
    sig: z.string().min(1),
    // exp comes in as a string from URL params; coerce to number
    exp: z.coerce.number().int().positive(),
    table: z.string().min(1).max(64),
});

export async function GET(request: NextRequest) {
    const url = request.nextUrl;

    const parsed = TrackQuerySchema.safeParse({
        slug: url.searchParams.get('slug'),
        order_id: url.searchParams.get('order_id'),
        sig: url.searchParams.get('sig'),
        exp: url.searchParams.get('exp'),
        table: url.searchParams.get('table'),
    });

    if (!parsed.success) {
        return apiError(
            `Invalid tracking parameters: ${parsed.error.issues.map(i => i.message).join(', ')}`,
            400,
            'INVALID_PARAMS'
        );
    }

    const { slug, order_id, sig, exp, table } = parsed.data;

    // ── 1. Verify HMAC signature ─────────────────────────────────────────────
    // This is the same check as resolveGuestContext but done without a DB
    // lookup, so unauthenticated guests can pass validation.
    const signatureCheck = verifySignedQRCode(slug, table, sig, exp);
    if (!signatureCheck.valid) {
        return apiError(
            signatureCheck.reason ?? 'Invalid or expired QR context',
            403,
            'INVALID_CONTEXT'
        );
    }

    // ── 2. Use service-role client (bypasses RLS — required for public guests) ─
    const supabase = createServiceRoleClient();

    // ── 3. Resolve restaurant by slug ─────────────────────────────────────────
    const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, is_active')
        .eq('slug', slug)
        .maybeSingle();

    if (restaurantError) {
        return apiError('Failed to resolve restaurant', 500, 'RESTAURANT_RESOLVE_FAILED');
    }
    if (!restaurant || restaurant.is_active === false) {
        return apiError('Restaurant not found or inactive', 404, 'RESTAURANT_NOT_FOUND');
    }

    const restaurantId = restaurant.id;

    // ── 4. Fetch the order — must belong to this restaurant ───────────────────
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, table_number, status, created_at, total_price')
        .eq('id', order_id)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

    if (orderError) {
        log.error('Order fetch failed', orderError);
        return apiError('Failed to fetch order', 500, 'ORDER_FETCH_FAILED');
    }
    if (!order) {
        return apiError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    // ── 5. Fetch KDS item-level statuses for live prep tracking ───────────────
    // kds_order_items may not exist yet if the KDS hasn't picked up the order;
    // return an empty array in that case — tracker will poll again.
    const { data: kdsItems, error: kdsError } = await supabase
        .from('kds_order_items')
        .select('id, name, quantity, station, status, notes, modifiers, started_at, ready_at')
        .eq('order_id', order_id)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true });

    if (kdsError) {
        log.warn('kds_order_items fetch warning', { error: kdsError });
    }

    return apiSuccess({
        order: {
            id: order.id,
            order_number: order.order_number,
            table_number: order.table_number,
            status: order.status,
            created_at: order.created_at,
            total_price: Number(order.total_price ?? 0) / 100,
        },
        items: kdsItems ?? [],
    });
}
