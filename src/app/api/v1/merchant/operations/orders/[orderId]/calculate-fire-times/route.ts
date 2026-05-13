/**
 * Calculate Fire Times API Endpoint
 * TASK-KDS-001: Fire by Prep Time
 *
 * POST /api/orders/[orderId]/calculate-fire-times
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
    calculateOrderFireTimes,
    calculateCourseFireTimes,
} from '@/features/kds/lib/prepTimeCalculator';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const { orderId } = await params;
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

        const _restaurantId = staffEntry.restaurant_id;

        // Parse request body
        const body = await request.json().catch(() => ({}));
        const targetCompletionTime = body.targetCompletionTime
            ? new Date(body.targetCompletionTime)
            : undefined;

        // Calculate fire times
        const result = await calculateOrderFireTimes(supabase, orderId, targetCompletionTime);

        if (!result.success) {
            return NextResponse.json(
                { error: { code: 'CALCULATION_FAILED', message: result.error } },
                { status: 400 }
            );
        }

        // Optionally use course-based firing
        if (body.courseBased) {
            const courseResult = await calculateCourseFireTimes(
                supabase,
                orderId,
                body.courseOptions
            );
            if (courseResult.success) {
                return NextResponse.json({
                    data: {
                        orderId,
                        calculation: courseResult.calculation,
                        courseBased: true,
                    },
                });
            }
        }

        return NextResponse.json({
            data: {
                orderId,
                calculation: result.calculation,
                courseBased: false,
            },
        });
    } catch (error) {
        console.error('[FireTimes API] Error:', error);
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
            { status: 500 }
        );
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const { orderId } = await params;
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
                            // Ignore errors
                        }
                    },
                },
            }
        );

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

        // Calculate fire times (read-only)
        const result = await calculateOrderFireTimes(supabase, orderId);

        if (!result.success) {
            return NextResponse.json(
                { error: { code: 'CALCULATION_FAILED', message: result.error } },
                { status: 400 }
            );
        }

        return NextResponse.json({
            data: {
                orderId,
                calculation: result.calculation,
            },
        });
    } catch (error) {
        console.error('[FireTimes API] Error:', error);
        return NextResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
            { status: 500 }
        );
    }
}
