import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody, parseQuery } from '@/lib/api/validation';
import { writeAuditLog } from '@/lib/api/audit';
import { isIdempotencyKeyValid, resolveIdempotencyKey } from '@/lib/api/idempotency';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { Json } from '@/types/database';

const ScheduleQuerySchema = z.object({
    start_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    end_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
});

const ShiftCreateSchema = z.object({
    staff_id: z.string().uuid(),
    role: z.enum(['owner', 'admin', 'manager', 'kitchen', 'waiter', 'bar']).optional(),
    shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
    station: z.string().trim().max(80).optional().nullable(),
    notes: z.string().trim().max(400).optional().nullable(),
});

function normalizeWindow(input: { start_date?: string; end_date?: string }) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const start = input.start_date ? new Date(`${input.start_date}T00:00:00`) : today;
    const end = input.end_date
        ? new Date(`${input.end_date}T00:00:00`)
        : new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000);

    const daySpan = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return {
        startIso: start.toISOString().slice(0, 10),
        endIso: end.toISOString().slice(0, 10),
        daySpan,
    };
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    return aStart < bEnd && bStart < aEnd;
}

export async function GET(request: Request) {
    try {
        const auth = await getAuthenticatedUser();
        if (!auth.ok) {
            return auth.response;
        }

        const context = await getAuthorizedRestaurantContext(auth.user.id, { phase: 'p1' });
        if (!context.ok) {
            return context.response;
        }

        const query = parseQuery(
            Object.fromEntries(new URL(request.url).searchParams.entries()),
            ScheduleQuerySchema
        );
        if (!query.success) {
            return query.response;
        }

        const { startIso, endIso, daySpan } = normalizeWindow(query.data);
        if (daySpan < 0 || daySpan > 31) {
            return apiError(
                'Invalid schedule window. Maximum span is 31 days.',
                400,
                'INVALID_SCHEDULE_WINDOW'
            );
        }

        console.warn(
            `[Schedule API] Fetching for restaurant ${context.restaurantId} from ${startIso} to ${endIso}`
        );

        const adminClient = createServiceRoleClient();

        // Use Promise.allSettled to debug which query fails if any
        const results = await Promise.allSettled([
            adminClient
                .from('shifts')
                .select(
                    'id, staff_id, role, shift_date, start_time, end_time, station, status, notes, created_at, updated_at'
                )
                .eq('restaurant_id', context.restaurantId)
                .gte('shift_date', startIso)
                .lte('shift_date', endIso)
                .order('shift_date', { ascending: true })
                .order('start_time', { ascending: true }),
            adminClient
                .from('restaurant_staff_with_users')
                .select(
                    'id, user_id, role, is_active, name, full_name, first_name, last_name, email'
                )
                .eq('restaurant_id', context.restaurantId)
                .eq('is_active', true)
                .order('created_at', { ascending: true }),
        ]);

        const shiftsRes = results[0];
        const staffRes = results[1];

        if (shiftsRes.status === 'rejected') {
            console.error('[Schedule API] Shifts query failed:', shiftsRes.reason);
            throw new Error('Shifts query failed');
        }
        if (staffRes.status === 'rejected') {
            console.error('[Schedule API] Staff query failed:', staffRes.reason);
            throw new Error('Staff query failed');
        }

        if (shiftsRes.value.error) {
            console.error('[Schedule API] Shifts DB error:', shiftsRes.value.error);
            return apiError(
                'Failed to fetch schedule',
                500,
                'SCHEDULE_FETCH_FAILED',
                shiftsRes.value.error.message
            );
        }
        if (staffRes.value.error) {
            console.error('[Schedule API] Staff DB error:', staffRes.value.error);
            // Fallback: If view query fails, try basic staff table?
            // For now, return error to see what's wrong.
            return apiError(
                'Failed to fetch staff',
                500,
                'STAFF_FETCH_FAILED',
                staffRes.value.error.message
            );
        }

        const staffData = staffRes.value.data ?? [];

        // Fix names: specific logic for "Owner" name replacement
        // If the name is "Owner" but the role is NOT owner, try to use email part or "Staff Member"
        const processedStaff = staffData.map(s => {
            let displayName = s.full_name || s.name || s.first_name || s.last_name;

            // If name is effectively "Owner" but they are not the actual owner role,
            // OR even if they are owner but we want a better name (user requested removing "Owner" as name).
            // Let's rely on email if name is generic "Owner".
            if (!displayName || displayName === 'Owner') {
                if (s.email) {
                    displayName = s.email.split('@')[0]; // Use 'makeemoneyonly' from 'makeemoneyonly@gmail.com'
                } else {
                    displayName = 'User';
                }
            }
            return {
                ...s,
                // We overwrite the raw fields or just ensure the UI uses a computed one?
                // The UI might use `name` or `first_name`. Let's populate specific fields.
                name: displayName,
                first_name: displayName.split(' ')[0],
                last_name: displayName.split(' ').slice(1).join(' ') || '',
            };
        });

        return apiSuccess({
            window: {
                start_date: startIso,
                end_date: endIso,
            },
            shifts: shiftsRes.value.data ?? [],
            staff: processedStaff,
        });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        console.error('[Schedule API] Unexpected error:', e);
        return apiError('Internal Server Error', 500, 'INTERNAL_ERROR', message);
    }
}

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

    const parsed = await parseJsonBody(request, ShiftCreateSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    if (parsed.data.end_time <= parsed.data.start_time) {
        return apiError('end_time must be after start_time', 400, 'INVALID_SHIFT_TIME_RANGE');
    }

    const { data: staffMember, error: staffError } = await context.supabase
        .from('restaurant_staff')
        .select('id, role, is_active')
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

    const { data: existingShifts, error: existingError } = await context.supabase
        .from('shifts')
        .select('id, start_time, end_time, status')
        .eq('restaurant_id', context.restaurantId)
        .eq('staff_id', parsed.data.staff_id)
        .eq('shift_date', parsed.data.shift_date)
        .in('status', ['scheduled', 'in_progress']);

    if (existingError) {
        return apiError(
            'Failed to validate schedule overlap',
            500,
            'SCHEDULE_OVERLAP_CHECK_FAILED',
            existingError.message
        );
    }

    const overlap = (existingShifts ?? []).find(shift =>
        overlaps(parsed.data.start_time, parsed.data.end_time, shift.start_time, shift.end_time)
    );
    if (overlap) {
        return apiError(
            'Shift overlaps with an existing active shift for this staff member',
            409,
            'SHIFT_OVERLAP_CONFLICT'
        );
    }

    const row = {
        restaurant_id: context.restaurantId,
        staff_id: parsed.data.staff_id,
        role: parsed.data.role ?? staffMember.role,
        shift_date: parsed.data.shift_date,
        start_time: parsed.data.start_time,
        end_time: parsed.data.end_time,
        station: parsed.data.station ?? null,
        notes: parsed.data.notes ?? null,
        status: 'scheduled',
        created_by: auth.user.id,
    };

    // HIGH-013: Explicit column selection
    const { data: inserted, error: insertError } = await context.supabase
        .from('shifts')
        .insert(row)
        .select(
            'id, restaurant_id, staff_id, shift_date, start_time, end_time, role, station, notes, status, created_by, created_at, updated_at'
        )
        .single();

    if (insertError) {
        return apiError('Failed to create shift', 500, 'SHIFT_CREATE_FAILED', insertError.message);
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'shift_created',
        entity_type: 'shift',
        entity_id: inserted.id,
        metadata: {
            source: 'merchant_dashboard',
            idempotency_key: idempotencyKey,
        },
        new_value: inserted as unknown as Json,
    });

    return apiSuccess({ shift: inserted, idempotency_key: idempotencyKey }, 201);
}
