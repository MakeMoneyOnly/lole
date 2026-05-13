import { apiError, apiSuccess } from '@/lib/api/response';
import { getAuthenticatedUser, getAuthorizedRestaurantContext } from '@/lib/api/authz';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
    const auth = await getAuthenticatedUser();
    if (!auth.ok) {
        return auth.response;
    }

    const context = await getAuthorizedRestaurantContext(auth.user.id);
    if (!context.ok) {
        return context.response;
    }

    // Query the enriched view that joins restaurant_staff with auth.users
    // This gives us real email/name which requires service role access to auth.users
    let adminClient;
    try {
        adminClient = createServiceRoleClient();
    } catch (e) {
        console.error('Service Role Client Creation Failed:', e);
        // Fallback to regular client if service role fails, though data might be incomplete due to RLS
        return apiError(
            'Server configuration error: Missing Service Role Key',
            500,
            'CONFIG_ERROR'
        );
    }

    const { data: baseStaff, error: baseError } = await adminClient
        .from('restaurant_staff')
        .select('id, user_id, role, is_active, created_at, name, pin_code, assigned_zones')
        .eq('restaurant_id', context.restaurantId)
        .order('created_at', { ascending: true });

    if (baseError) {
        return apiError('Failed to fetch staff list', 500, 'STAFF_FETCH_FAILED', baseError.message);
    }

    const staffRows = (baseStaff ?? []) as Array<{
        id: string;
        user_id: string | null;
        role: string;
        is_active: boolean | null;
        created_at: string | null;
        name?: string | null;
        pin_code?: string | null;
        assigned_zones?: string[] | null;
    }>;

    const userIds = staffRows
        .map(row => row.user_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0);

    let enrichedByStaffId = new Map<
        string,
        {
            email?: string | null;
            name?: string | null;
            full_name?: string | null;
            first_name?: string | null;
            last_name?: string | null;
        }
    >();

    if (userIds.length > 0) {
        const { data: enrichedRows, error: enrichedError } = await adminClient
            .from('restaurant_staff_with_users')
            .select('id, user_id, email, name, full_name, first_name, last_name')
            .eq('restaurant_id', context.restaurantId)
            .in('user_id', userIds);

        if (enrichedError) {
            console.warn('[GET /api/staff] enriched view fetch failed:', enrichedError.message);
        } else {
            enrichedByStaffId = new Map(
                ((enrichedRows ?? []) as Array<Record<string, unknown>>).map(row => [
                    String(row.id ?? ''),
                    {
                        email: (row.email as string | null | undefined) ?? null,
                        name: (row.name as string | null | undefined) ?? null,
                        full_name: (row.full_name as string | null | undefined) ?? null,
                        first_name: (row.first_name as string | null | undefined) ?? null,
                        last_name: (row.last_name as string | null | undefined) ?? null,
                    },
                ])
            );
        }
    }

    const staff = staffRows.map(row => {
        const enriched = enrichedByStaffId.get(row.id);
        return {
            id: row.id,
            user_id: row.user_id,
            role: row.role,
            is_active: row.is_active,
            created_at: row.created_at,
            name: enriched?.name ?? row.name ?? null,
            full_name: enriched?.full_name ?? null,
            first_name: enriched?.first_name ?? null,
            last_name: enriched?.last_name ?? null,
            email: enriched?.email ?? null,
            pin_code: row.pin_code ?? null,
            assigned_zones: row.assigned_zones ?? [],
        };
    });

    return apiSuccess({ staff });
}
