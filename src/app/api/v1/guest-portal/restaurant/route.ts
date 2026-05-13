import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/guest-portal/restaurant?slug=<slug>
 *
 * Public endpoint that returns basic restaurant info for online ordering.
 * No authentication or QR validation required — this powers the storefront link.
 */
export async function GET(request: NextRequest) {
    const slug = request.nextUrl.searchParams.get('slug');

    if (!slug || slug.trim().length === 0) {
        return NextResponse.json({ error: 'Missing slug parameter.' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('id, name, logo_url, slug')
        .ilike('slug', slug.trim())
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch restaurant.' }, { status: 500 });
    }

    if (!restaurant) {
        return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
    }

    return NextResponse.json(
        {
            data: {
                restaurant_id: restaurant.id,
                restaurant_name: restaurant.name,
                restaurant_logo_url: restaurant.logo_url,
                slug: restaurant.slug,
            },
        },
        { status: 200 }
    );
}
