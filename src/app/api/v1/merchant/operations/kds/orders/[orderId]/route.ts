import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const UpdateKDSStatusSchema = z.object({
    status: z.enum(['acknowledged', 'preparing', 'ready']),
});

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['acknowledged', 'preparing'],
    acknowledged: ['preparing', 'ready'],
    preparing: ['ready'],
    ready: [],
    served: [],
    completed: [],
    cancelled: [],
};

function canTransition(current: string | null, next: string): boolean {
    if (!current) return false;
    return (ALLOWED_TRANSITIONS[current] || []).includes(next);
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await context.params;

    try {
        const payload = await request.json();
        const parsed = UpdateKDSStatusSchema.safeParse(payload);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid request payload', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const supabase = await createClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('id, restaurant_id, status')
            .eq('id', orderId)
            .maybeSingle();

        if (orderError) {
            return NextResponse.json({ error: 'Failed to load order' }, { status: 500 });
        }

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const { data: staff, error: staffError } = await supabase
            .from('restaurant_staff')
            .select('id')
            .eq('restaurant_id', order.restaurant_id)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

        if (staffError) {
            return NextResponse.json({ error: 'Failed to verify staff access' }, { status: 500 });
        }

        if (!staff) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!canTransition(order.status, parsed.data.status)) {
            return NextResponse.json(
                {
                    error: `Invalid status transition from "${order.status}" to "${parsed.data.status}"`,
                },
                { status: 409 }
            );
        }

        const now = new Date().toISOString();
        const updatePayload: Record<string, string> = {
            status: parsed.data.status,
            kitchen_status: parsed.data.status,
            updated_at: now,
        };

        if (parsed.data.status === 'acknowledged') {
            updatePayload.acknowledged_at = now;
        }
        if (parsed.data.status === 'ready') {
            updatePayload.completed_at = now;
        }

        const { data: updatedOrder, error: updateError } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', order.id)
            .select(
                'id, restaurant_id, table_id, status, kitchen_status, total_amount, currency, customer_name, customer_phone, notes, acknowledged_at, completed_at, created_at, updated_at'
            )
            .single();

        if (updateError || !updatedOrder) {
            return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
        }

        const { error: auditError } = await supabase.from('audit_logs').insert({
            restaurant_id: order.restaurant_id,
            user_id: user.id,
            action: 'kds_order_status_updated',
            entity_type: 'order',
            entity_id: order.id,
            old_value: { status: order.status },
            new_value: { status: parsed.data.status },
            metadata: { source: 'kds_web' },
        });

        if (auditError) {
            console.warn('[PATCH /api/kds/orders/:id] audit insert failed:', auditError.message);
        }

        return NextResponse.json({ data: updatedOrder }, { status: 200 });
    } catch (error) {
        console.error('[PATCH /api/kds/orders/:id] failed:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
