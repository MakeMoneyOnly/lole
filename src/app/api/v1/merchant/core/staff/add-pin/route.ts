import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { parseJsonBody } from '@/lib/api/validation';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { writeAuditLog } from '@/lib/api/audit';
import { hashStaffPin } from '@/domains/staff/pin';

const AddPinStaffSchema = z.object({
    name: z.string().trim().min(2).max(120),
    role: z.enum(['kitchen', 'waiter', 'bar', 'runner']),
    pin_code: z.string().length(4),
    assigned_zones: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    const parsed = await parseJsonBody(request, AddPinStaffSchema);
    if (!parsed.success) {
        return parsed.response;
    }

    const adminClient = createServiceRoleClient();

    // Insert staff with ONLY pin/name, no auth user_id since they don't sign in via Supabase Auth
    const { data, error } = await adminClient
        .from('restaurant_staff')
        .insert({
            restaurant_id: context.restaurantId,
            name: parsed.data.name,
            role: parsed.data.role,
            pin_code: hashStaffPin(parsed.data.pin_code),
            assigned_zones: parsed.data.assigned_zones ?? [],
            is_active: true,
        })
        // HIGH-013: Explicit column selection
        .select(
            'id, restaurant_id, name, role, pin_code, assigned_zones, is_active, user_id, created_at'
        )
        .single();

    if (error) {
        if (/idx_restaurant_staff_pin_unique/i.test(error.message)) {
            return apiError('PIN already in use. Please choose another.', 400, 'DUPLICATE_PIN');
        }
        return apiError('Failed to create staff member', 500, 'STAFF_CREATE_FAILED', error.message);
    }

    await writeAuditLog(context.supabase, {
        restaurant_id: context.restaurantId,
        user_id: auth.user.id,
        action: 'staff_pin_created',
        entity_type: 'restaurant_staff',
        entity_id: data.id,
        metadata: {
            role: parsed.data.role,
            name: parsed.data.name,
        },
        new_value: {
            status: data.is_active,
        },
    });

    return apiSuccess(
        {
            staff: {
                ...data,
                pin_code: null,
            },
        },
        201
    );
}
