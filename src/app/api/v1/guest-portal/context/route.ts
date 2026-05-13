import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveGuestContext } from '@/lib/security/guestContext';

export async function GET(request: NextRequest) {
    const slug = request.nextUrl.searchParams.get('slug');
    const table = request.nextUrl.searchParams.get('table');
    const sig = request.nextUrl.searchParams.get('sig');
    const exp = request.nextUrl.searchParams.get('exp');

    const supabase = await createClient();
    const context = await resolveGuestContext(supabase, { slug, table, sig, exp });

    if (!context.valid) {
        return NextResponse.json({ error: context.reason }, { status: context.status });
    }

    return NextResponse.json(
        {
            data: {
                restaurant_id: context.data.restaurantId,
                table_id: context.data.tableId,
                table_number: context.data.tableNumber,
                slug: context.data.slug,
                sig: context.data.signature,
                exp: context.data.expiresAt,
            },
        },
        { status: 200 }
    );
}
