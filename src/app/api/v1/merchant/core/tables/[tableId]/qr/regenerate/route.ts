import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { generateSignedQRCode } from '@/lib/security/hmac';
import { getRequestOrigin } from '@/lib/api/requestOrigin';

export async function POST(request: Request, context: { params: Promise<{ tableId: string }> }) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const restaurantContext = await getAuthorizedRestaurantContext(auth.user.id);
    if (!restaurantContext.ok) {
        return restaurantContext.response;
    }

    const { tableId } = await context.params;
    const { data: table, error: tableError } = await restaurantContext.supabase
        .from('tables')
        .select('id, table_number, qr_version, restaurant_id')
        .eq('id', tableId)
        .eq('restaurant_id', restaurantContext.restaurantId)
        .maybeSingle();

    if (tableError) {
        return apiError('Failed to fetch table', 500, 'TABLE_FETCH_FAILED', tableError.message);
    }
    if (!table) {
        return apiError('Table not found', 404, 'TABLE_NOT_FOUND');
    }

    const { data: restaurant, error: restaurantError } = await restaurantContext.supabase
        .from('restaurants')
        .select('slug')
        .eq('id', table.restaurant_id as string)
        .maybeSingle();

    if (restaurantError) {
        return apiError(
            'Failed to fetch restaurant slug',
            500,
            'RESTAURANT_FETCH_FAILED',
            restaurantError.message
        );
    }
    if (!restaurant?.slug) {
        return apiError('Restaurant slug missing', 500, 'RESTAURANT_SLUG_MISSING');
    }

    const origin = getRequestOrigin(request);
    const qr = generateSignedQRCode(restaurant.slug, table.table_number, origin);

    const { data: updatedTable, error: updateError } = await restaurantContext.supabase
        .from('tables')
        .update({
            qr_code_url: qr.url,
            qr_version: (table.qr_version ?? 1) + 1,
        })
        .eq('id', table.id)
        .select('id, table_number, qr_code_url, qr_version')
        .single();

    if (updateError) {
        return apiError(
            'Failed to update table QR code',
            500,
            'TABLE_QR_UPDATE_FAILED',
            updateError.message
        );
    }

    return apiSuccess({
        table: updatedTable,
        qr: {
            url: qr.url,
            signature: qr.signature,
            expires_at: qr.expiresAt,
        },
    });
}
