/**
 * Price Override API Endpoint
 * TASK-POS-001: Price Overrides with Audit Trail
 *
 * POST /api/orders/[orderId]/items/[itemId]/override-price
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import {
    canOverridePrices,
    createPriceOverride,
    validatePriceOverrideInput,
} from '@/lib/services/priceOverrideService';

const log = logger.child('merchant-operations/orders/items/override-price');

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string; itemId: string }> }
) {
    try {
        const { orderId, itemId } = await params;
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            );
                        } catch {
                            // Ignore errors in middleware
                        }
                    },
                },
            }
        );

        // Get authenticated user
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
                { status: 401 }
            );
        }

        // Parse request body
        const body = await request.json();

        // Validate input
        const validation = validatePriceOverrideInput({
            orderId,
            orderItemId: itemId,
            ...body,
        });

        if (!validation.valid) {
            return NextResponse.json(
                {
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid input',
                        details: validation.errors,
                    },
                },
                { status: 400 }
            );
        }

        // Get user's restaurant membership
        const { data: staffEntry, error: staffError } = await supabase
            .from('restaurant_staff')
            .select('restaurant_id, role')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle();

        if (staffError || !staffEntry) {
            return NextResponse.json(
                { error: { code: 'FORBIDDEN', message: 'Not a staff member' } },
                { status: 403 }
            );
        }

        const restaurantId = staffEntry.restaurant_id;

        // Check permission
        const permissionCheck = await canOverridePrices(supabase, user.id, restaurantId);
        if (!permissionCheck.allowed) {
            return NextResponse.json(
                { error: { code: 'FORBIDDEN', message: permissionCheck.reason } },
                { status: 403 }
            );
        }

        // Create price override
        const result = await createPriceOverride(supabase, restaurantId, {
            orderId,
            orderItemId: itemId,
            originalPrice: body.originalPrice,
            newPrice: body.newPrice,
            reasonCode: body.reasonCode,
            reasonNotes: body.reasonNotes,
            staffId: user.id,
            approvedBy: body.approvedBy,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: { code: 'OVERRIDE_FAILED', message: result.error } },
                { status: 400 }
            );
        }

        // Log to audit
        await supabase.from('audit_logs').insert({
            action: 'price_override',
            entity_type: 'order_item',
            entity_id: itemId,
            restaurant_id: restaurantId,
            user_id: user.id,
            metadata: {
                order_id: orderId,
                original_price: body.originalPrice,
                new_price: body.newPrice,
                reason_code: body.reasonCode,
            },
        });

        return NextResponse.json({
            data: result.override,
            meta: { message: 'Price override applied successfully' },
        });
    } catch (error) {
        log.error('Error', error);
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
            { status: 500 }
        );
    }
}
