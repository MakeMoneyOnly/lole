import { apiError, apiSuccess } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { auditWaitlistEntry } from '../../shared/audit-helpers';

export async function notifyEntryHandler(
    request: Request,
    context: { params: Promise<{ id: string }> }
): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId, user } = auth;
        const resolvedParams = await context.params;
        const entryId = resolvedParams.id;

        const { data: entry, error: entryError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('waitlist_entries')
                .select('id, restaurant_id, status')
                .eq('id', entryId)
                .eq('restaurant_id', restaurantId)
                .maybeSingle();

        if (entryError) {
            return apiError(
                'Failed to fetch waitlist entry',
                500,
                'WAITLIST_FETCH_FAILED',
                entryError.message
            );
        }

        if (!entry) {
            return apiError('Waitlist entry not found', 404, 'WAITLIST_NOT_FOUND');
        }

        if (entry.status === 'seated') {
            return apiError('Guest has already been seated', 400, 'ALREADY_SEATED');
        }

        if (entry.status === 'cancelled') {
            return apiError('Waitlist entry was cancelled', 400, 'ALREADY_CANCELLED');
        }

        const now = new Date().toISOString();
        const { data: updatedEntry, error: updateError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('waitlist_entries')
                .update({
                    status: 'notified',
                    notified_at: now,
                })
                .eq('id', entryId)
                .select()
                .single();

        if (updateError) {
            return apiError(
                'Failed to notify guest',
                500,
                'WAITLIST_NOTIFY_FAILED',
                updateError.message
            );
        }

        await auditWaitlistEntry(supabase, restaurantId, {
            entryId,
            userId: user.id,
            action: 'notified',
        });

        return apiSuccess({
            message: 'Guest notified successfully',
            entry: updatedEntry,
        });
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'notifyEntry',
        });
    }
}
