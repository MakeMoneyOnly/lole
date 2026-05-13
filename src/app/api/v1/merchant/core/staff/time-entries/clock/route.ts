import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import type { Json } from '@/types/database';

const ClockActionSchema = z.object({
    staff_id: z.string().uuid(),
    action: z.enum(['in', 'out']),
    shift_id: z.string().uuid().optional(),
    occurred_at: z.string().datetime().optional(),
    source: z.enum(['dashboard', 'mobile', 'kiosk', 'api']).optional(),
    note: z.string().trim().max(240).optional(),
});

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
    if (!context.ok) {
        return context.response;
    }

    const explicitIdempotencyKey = request.headers.get('x-idempotency-key');
    if (explicitIdempotencyKey && !isIdempotencyKeyValid(explicitIdempotencyKey)) {
        return apiError('Invalid idempotency key', 400, 'INVALID_IDEMPOTENCY_KEY');
    }
    const idempotencyKey = resolveIdempotencyKey(explicitIdempotencyKey);

    const parsed = await parseJsonBody(request, ClockActionSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const occurredAt = parsed.data.occurred_at ?? new Date().toISOString();

    const { data: staffMember, error: staffError } = await context.supabase
        .from('restaurant_staff')
        .select('id, is_active')
        .eq('id', parsed.data.staff_id)
        .eq('restaurant_id', context.restaurantId)
        .maybeSingle();

    if (staffError) {
        return apiError(
            'Failed to load staff member',
            500,
            'STAFF_FETCH_FAILED',
            staffError.message
        );
    }
    if (!staffMember || staffMember.is_active === false) {
        return apiError('Staff member not found or inactive', 404, 'STAFF_NOT_FOUND');
    }

    const { data: openEntry, error: openEntryError } = await context.supabase
        .from('time_entries')
        .select('id, shift_id, staff_id, clock_in_at, clock_out_at')
        .eq('restaurant_id', context.restaurantId)
        .eq('staff_id', parsed.data.staff_id)
        .is('clock_out_at', null)
        .order('clock_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (openEntryError) {
        return apiError(
            'Failed to load open time entry',
            500,
            'TIME_ENTRY_FETCH_FAILED',
            openEntryError.message
        );
    }

    if (parsed.data.action === 'in') {
        if (openEntry) {
            return apiError('Staff member is already clocked in', 409, 'CLOCK_ALREADY_OPEN');
        }

        const { data: inserted, error: insertError } = await context.supabase
            .from('time_entries')
            .insert({
                restaurant_id: context.restaurantId,
                staff_id: parsed.data.staff_id,
                shift_id: parsed.data.shift_id || null,
                clock_in_at: occurredAt,
            })
            // HIGH-013: Explicit column selection
            .select(
                'id, restaurant_id, staff_id, shift_id, clock_in_at, clock_out_at, status, source, metadata, created_by, created_at, updated_at'
            )
            .single();

        if (insertError) {
            return apiError('Failed to clock in', 500, 'CLOCK_IN_FAILED', insertError.message);
        }

        if (parsed.data.shift_id) {
            await context.supabase
                .from('shifts')
                .update({ status: 'in_progress' })
                .eq('id', parsed.data.shift_id)
                .eq('restaurant_id', context.restaurantId);
        }

        await writeAuditLog(context.supabase, {
            restaurant_id: context.restaurantId,
            user_id: auth.user.id,
            action: 'staff_clock_in',
            entity_type: 'time_entry',
            entity_id: inserted.id,
            metadata: {
                source: parsed.data.source ?? 'dashboard',
                idempotency_key: idempotencyKey,
            } as Json,
            new_value: inserted as unknown as Json,
        });

        return apiSuccess(
            {
                entry: inserted,
                action: 'in',
                idempotency_key: idempotencyKey,
            },
            201
        );
    }

    if (!openEntry) {
        return apiError(
            'No open time entry found for staff member',
            409,
            'CLOCK_OUT_WITHOUT_OPEN_ENTRY'
        );
    }

    const { data: updated, error: updateError } = await context.supabase
        .from('time_entries')
        .update({
            clock_out_at: occurredAt,
            status: 'closed',
        })
        .eq('id', openEntry.id)
        .eq('restaurant_id', context.restaurantId)
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, staff_id, shift_id, clock_in_at, clock_out_at, status, source, metadata, created_by, created_at, updated_at'
        )
        .single();

    if (updateError) {
        return apiError('Failed to clock out', 500, 'CLOCK_OUT_FAILED', updateError.message);
    }

    if (openEntry.shift_id) {
        const { data: stillOpenForShift } = await context.supabase
            .from('time_entries')
            .select('id')
            .eq('restaurant_id', context.restaurantId)
            .eq('shift_id', openEntry.shift_id)
            .eq('status', 'open')
            .limit(1);

        if (!stillOpenForShift || stillOpenForShift.length === 0) {
            await context.supabase
                .from('shifts')
                .update({ status: 'completed' })
                .eq('id', openEntry.shift_id)
                .eq('restaurant_id', context.restaurantId)
                .neq('status', 'cancelled');
        }
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'staff_clock_out',
        entity_type: 'time_entry',
        entity_id: updated.id,
        old_value: null,
        new_value: updated as unknown as Json,
        metadata: {
            source: parsed.data.source ?? 'dashboard',
            idempotency_key: idempotencyKey,
        } as Json,
    });

    return apiSuccess({
        entry: updated,
        action: 'out',
        idempotency_key: idempotencyKey,
    });
}
