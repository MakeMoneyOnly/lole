import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { enforcePilotAccess } from '@/lib/api/pilotGate';
import { ORDER_LIST_COLUMNS, columnsToString } from '@/lib/constants/query-columns';

export async function GET(request: Request) {
    try {
        console.warn('[API] Starting merchant activity fetch...');
        const supabase = await createClient();

        // Get the current user
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        console.warn('[API] User check:', {
            hasUser: !!user,
            userId: user?.id,
            userError: userError?.message,
        });

        if (userError || !user) {
            console.warn('[API] No user found, returning 401');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get the user's restaurant ID
        const { data: staffEntry, error: staffError } = await supabase
            .from('restaurant_staff')
            .select('restaurant_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        console.warn('[API] Staff lookup:', {
            staffEntry,
            staffError: staffError?.message,
        });

        let restaurantId = staffEntry?.restaurant_id;

        // Fallback to agency_users
        if (!restaurantId) {
            const { data: agencyUser, error: agencyError } = await supabase
                .from('agency_users')
                .select('restaurant_ids')
                .eq('user_id', user.id)
                .maybeSingle();

            console.warn('[API] Agency lookup:', {
                agencyUser,
                agencyError: agencyError?.message,
            });

            if (agencyUser?.restaurant_ids?.[0]) {
                restaurantId = agencyUser.restaurant_ids[0];
            }
        }

        console.warn('[API] Final restaurant ID:', restaurantId);

        if (!restaurantId) {
            console.warn('[API] No restaurant found for user');
            return NextResponse.json({ error: 'No restaurant found for user' }, { status: 404 });
        }

        const pilotGateResponse = enforcePilotAccess(restaurantId, request.method);
        if (pilotGateResponse) {
            return pilotGateResponse;
        }

        // MED-004: Use Promise.all for parallel queries
        // Fetch orders, service requests, and restaurant info in parallel
        const [ordersResult, requestsResult, restaurantResult] = await Promise.all([
            // Fetch orders
            supabase
                .from('orders')
                .select(columnsToString(ORDER_LIST_COLUMNS))
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: false })
                .limit(20),
            // Fetch service requests
            supabase
                .from('service_requests')
                .select('id, restaurant_id, table_number, request_type, status, created_at, notes')
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: false })
                .limit(20),
            // Get restaurant info
            supabase.from('restaurants').select('name, slug').eq('id', restaurantId).single(),
        ]);

        const { data: orders, error: orderError } = ordersResult;
        const { data: requests, error: requestError } = requestsResult;
        const { data: restaurant } = restaurantResult;

        console.warn('[API] Orders fetch:', {
            count: orders?.length || 0,
            error: orderError?.message,
        });

        console.warn('[API] Requests fetch:', {
            count: requests?.length || 0,
            error: requestError?.message,
        });

        console.warn('[API] Restaurant info:', restaurant);

        const response = {
            orders: orders || [],
            requests: requests || [],
            restaurant: restaurant || { name: 'Restaurant', slug: 'restaurant' },
            restaurantId,
            errors: {
                orders: orderError?.message,
                requests: requestError?.message,
            },
        };

        console.warn('[API] Returning response with:', {
            orderCount: response.orders.length,
            requestCount: response.requests.length,
            restaurantName: response.restaurant.name,
        });

        return NextResponse.json(response);
    } catch (error) {
        console.error('[API] Error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
