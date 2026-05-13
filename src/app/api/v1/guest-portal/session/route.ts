import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { resolveGuestContext } from '@/lib/security/guestContext';

const UpsertGuestSessionSchema = z.object({
    session_id: z.string().uuid().optional(),
    guest_context: z.object({
        slug: z.string().min(1),
        table: z.string().min(1),
        sig: z.string().min(1),
        exp: z.union([z.string(), z.number()]),
    }),
    source: z.enum(['qr', 'campaign_qr', 'direct_link', 'other']).optional(),
    skip_selected: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = UpsertGuestSessionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request payload', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const guestContext = await resolveGuestContext(supabase, parsed.data.guest_context);
        if (!guestContext.valid) {
            return NextResponse.json(
                { error: guestContext.reason },
                { status: guestContext.status }
            );
        }

        const {
            data: { user },
        } = await supabase.auth.getUser();

        const authState = user ? 'authenticated' : 'guest';
        const now = new Date().toISOString();
        const db = createServiceRoleClient();

        if (parsed.data.session_id) {
            const { data: existingSession, error: sessionLookupError } = await db
                .from('guest_menu_sessions')
                .select('id, restaurant_id, table_id, auth_state')
                .eq('id', parsed.data.session_id)
                .maybeSingle();

            if (sessionLookupError) {
                return NextResponse.json({ error: sessionLookupError.message }, { status: 500 });
            }

            if (
                existingSession &&
                existingSession.restaurant_id === guestContext.data.restaurantId &&
                existingSession.table_id === guestContext.data.tableId
            ) {
                const patch: Record<string, unknown> = { last_seen_at: now };

                if (authState === 'authenticated' && user) {
                    patch.auth_state = 'authenticated';
                    patch.user_id = user.id;
                    if (existingSession.auth_state === 'guest') {
                        patch.converted_at = now;
                    }
                }

                if (parsed.data.skip_selected) {
                    patch.metadata = { skip_selected_at: now };
                }

                const { data: updatedSession, error: updateError } = await db
                    .from('guest_menu_sessions')
                    .update(patch)
                    .eq('id', existingSession.id)
                    .select('id, auth_state, user_id, started_at, last_seen_at')
                    .single();

                if (updateError) {
                    return NextResponse.json({ error: updateError.message }, { status: 500 });
                }

                return NextResponse.json({
                    data: {
                        session_id: updatedSession.id,
                        auth_state: updatedSession.auth_state,
                        is_authenticated: updatedSession.auth_state === 'authenticated',
                    },
                });
            }
        }

        const { data: createdSession, error: insertError } = await db
            .from('guest_menu_sessions')
            .insert({
                restaurant_id: guestContext.data.restaurantId,
                table_id: guestContext.data.tableId,
                table_number: guestContext.data.tableNumber,
                slug: guestContext.data.slug,
                source: parsed.data.source ?? 'qr',
                auth_state: authState,
                user_id: user?.id ?? null,
                converted_at: authState === 'authenticated' ? now : null,
                metadata: parsed.data.skip_selected ? { skip_selected_at: now } : {},
            })
            .select('id, auth_state')
            .single();

        if (insertError || !createdSession) {
            return NextResponse.json(
                { error: insertError?.message ?? 'Failed to create session.' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            data: {
                session_id: createdSession.id,
                auth_state: createdSession.auth_state,
                is_authenticated: createdSession.auth_state === 'authenticated',
            },
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
