import { apiError, apiSuccess } from '@/lib/api/response';
import { requireMerchantAuth } from '../../shared/auth-middleware';
import { CreateWaitlistEntrySchema } from '../contracts';
import { auditWaitlistEntry } from '../../shared/audit-helpers';

interface WaitlistEntry {
    id: string;
    restaurant_id: string;
    guest_name: string;
    guest_phone: string;
    guest_count: number;
    status: string;
    position?: number;
    notes: string | null;
}

export async function createEntryHandler(request: Request): Promise<Response> {
    try {
        const auth = await requireMerchantAuth(request);

        if (!auth.ok) {
            return auth.response;
        }

        const { supabase, restaurantId, user } = auth;

        const body = await request.json();
        const validated = CreateWaitlistEntrySchema.parse({
            ...body,
            restaurantId,
        });

        const { data: entries, error: countError } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('waitlist_entries')
                .select('id', { count: 'exact' })
                .eq('restaurant_id', restaurantId)
                .eq('status', 'waiting');

        if (countError) {
            return apiError(
                'Failed to calculate waitlist position',
                500,
                'WAITLIST_POSITION_FAILED',
                countError.message
            );
        }

        const position = (entries?.length ?? 0) + 1;

        const { data: entry, error } =
            await // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase as any)
                .from('waitlist_entries')
                .insert({
                    restaurant_id: restaurantId,
                    guest_name: validated.guestName,
                    guest_phone: validated.guestPhone,
                    guest_count: validated.guestCount,
                    notes: validated.notes,
                    status: 'waiting',
                    position,
                })
                .select('*')
                .single();

        if (error) {
            return apiError(
                'Failed to create waitlist entry',
                500,
                'WAITLIST_CREATE_FAILED',
                error.message
            );
        }

        await auditWaitlistEntry(supabase, restaurantId, {
            entryId: (entry as WaitlistEntry).id,
            userId: user.id,
            action: 'created',
            partySize: (entry as WaitlistEntry).guest_count,
        });

        return apiSuccess(entry as WaitlistEntry, 201);
    } catch (error) {
        return apiError(error, 500, 'INTERNAL_ERROR', undefined, {
            operation: 'createEntry',
        });
    }
}
