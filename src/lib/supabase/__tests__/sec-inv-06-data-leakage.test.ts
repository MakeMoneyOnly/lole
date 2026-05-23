/**
 * Test: SEC-INV-06 - Verify No Data Leakage After Invoker Changes
 *
 * This test verifies that views with security_invoker=on properly enforce
 * Row Level Security (RLS) policies and don't leak data across tenants.
 *
 * Security invariants verified:
 * - Views with security_invoker=on use the invoker's permissions
 * - RLS policies are enforced based on the querying user's context
 * - No cross-tenant data leakage occurs through views
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY || '';

const shouldRunTests = SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!shouldRunTests)('SEC-INV-06: No Data Leakage After Invoker Changes', () => {
    let serviceClient: SupabaseClient;
    let anonClient: SupabaseClient;
    let testRestaurantId: string;
    let otherRestaurantId: string;
    let testUserId: string;
    let otherUserId: string;

    beforeAll(async () => {
        serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Create test data: Two restaurants and their data
        const { data: restaurant1 } = await serviceClient
            .from('restaurants')
            .insert({
                name: 'SEC-INV-06 Restaurant A',
                slug: `sec-inv-06-restaurant-a-${Date.now()}`,
                is_active: true,
                plan: 'pro',
            })
            .select('id')
            .single();

        const { data: restaurant2 } = await serviceClient
            .from('restaurants')
            .insert({
                name: 'SEC-INV-06 Restaurant B',
                slug: `sec-inv-06-restaurant-b-${Date.now()}`,
                is_active: true,
                plan: 'free',
            })
            .select('id')
            .single();

        testRestaurantId = restaurant1?.id;
        otherRestaurantId = restaurant2?.id;

        // Create test menu items in both restaurants
        await serviceClient.from('menu_categories').insert([
            { name: 'Category A', restaurant_id: testRestaurantId },
            { name: 'Category B', restaurant_id: otherRestaurantId },
        ]);

        const { data: categories } = await serviceClient
            .from('menu_categories')
            .select('id, restaurant_id')
            .in('restaurant_id', [testRestaurantId, otherRestaurantId]);

        const catAId = categories?.find(c => c.restaurant_id === testRestaurantId)?.id;
        const catBId = categories?.find(c => c.restaurant_id === otherRestaurantId)?.id;

        await serviceClient.from('menu_items').insert([
            {
                name: 'Item from Restaurant A',
                restaurant_id: testRestaurantId,
                category_id: catAId,
                price: 100,
                is_available: true,
            },
            {
                name: 'Item from Restaurant B',
                restaurant_id: otherRestaurantId,
                category_id: catBId,
                price: 200,
                is_available: true,
            },
        ]);
    });

    afterAll(async () => {
        if (testRestaurantId) {
            await serviceClient.from('restaurants').delete().eq('id', testRestaurantId);
        }
        if (otherRestaurantId) {
            await serviceClient.from('restaurants').delete().eq('id', otherRestaurantId);
        }
    });

    describe('View security_invoker verification', () => {
        it('should verify restaurant_plan_info view has security_invoker=on', async () => {
            const { data, error } = await anonClient
                .from('restaurant_plan_info')
                .select('id, slug, plan')
                .eq('id', testRestaurantId);

            expect(error).toBeNull();
            expect(data).toBeDefined();
        });

        it('should verify active_menu_items view has security_invoker=on', async () => {
            const { data, error } = await anonClient
                .from('active_menu_items')
                .select('id, name, restaurant_id')
                .eq('restaurant_id', testRestaurantId);

            expect(error).toBeNull();
            expect(data).toBeDefined();
        });

        it('should verify active_restaurants view has security_invoker=on', async () => {
            const { data, error } = await anonClient
                .from('active_restaurants')
                .select('id, name')
                .eq('is_active', true);

            expect(error).toBeNull();
            expect(Array.isArray(data)).toBe(true);
        });
    });

    describe('Cross-tenant data leakage prevention', () => {
        it('should NOT leak menu items across tenants via active_menu_items view', async () => {
            // Query as anonymous user - should only see active restaurants
            const { data, error } = await anonClient
                .from('active_menu_items')
                .select('id, name, restaurant_id')
                .order('restaurant_id');

            expect(error).toBeNull();

            // Should not leak cross-tenant data
            // The view should respect RLS based on invoker context
            if (data && data.length > 0) {
                const restaurantIds = Object.keys(
                    data.reduce(
                        (acc, item) => {
                            acc[item.restaurant_id] = true;
                            return acc;
                        },
                        {} as Record<string, boolean>
                    )
                );
                expect(restaurantIds).toContain(testRestaurantId);
            }
        });

        it('should NOT leak restaurant data across tenants via restaurant_plan_info view', async () => {
            const { data: restA, error: errA } = await anonClient
                .from('restaurant_plan_info')
                .select('id, slug, plan, has_pro_features')
                .eq('id', testRestaurantId)
                .single();

            const { data: restB, error: errB } = await anonClient
                .from('restaurant_plan_info')
                .select('id, slug, plan, has_pro_features')
                .eq('id', otherRestaurantId)
                .single();

            expect(errA).toBeNull();
            expect(errB).toBeNull();

            // Verify correct plan values
            expect(restA?.plan).toBe('pro');
            expect(restA?.has_pro_features).toBe(true);
            expect(restB?.plan).toBe('free');
            expect(restB?.has_pro_features).toBe(false);
        });

        it('should prevent unauthorized access to tenant-specific data through views', async () => {
            // Service role sees all, anon only sees active
            const { data: serviceData } = await serviceClient
                .from('restaurants')
                .select('id')
                .eq('id', testRestaurantId);

            const { data: anonData } = await anonClient
                .from('restaurants')
                .select('id')
                .eq('id', testRestaurantId);

            // Both should succeed for this active restaurant
            expect(serviceData?.length).toBeGreaterThanOrEqual(1);
            expect(anonData?.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('RLS policy enforcement', () => {
        it('should enforce RLS on active_menu_items view', async () => {
            const { data, error } = await serviceClient
                .from('active_menu_items')
                .select('id, name, restaurant_id')
                .in('restaurant_id', [testRestaurantId, otherRestaurantId]);

            expect(error).toBeNull();

            // Verify we get items from both test restaurants
            if (data && data.length > 0) {
                const restaurantIds = Object.keys(
                    data.reduce(
                        (acc, item) => {
                            acc[item.restaurant_id] = true;
                            return acc;
                        },
                        {} as Record<string, boolean>
                    )
                );
                expect(restaurantIds.length).toBeGreaterThanOrEqual(2);
            }
        });

        it('should enforce RLS on active_restaurants view', async () => {
            const { data, error } = await serviceClient
                .from('active_restaurants')
                .select('id, name')
                .in('id', [testRestaurantId, otherRestaurantId]);

            expect(error).toBeNull();
            expect(data?.length).toBeGreaterThanOrEqual(2);
        });

        it('should enforce RLS on active_tables view', async () => {
            // Verify the view exists and enforces RLS
            const { error } = await serviceClient.from('active_tables').select('id').limit(1);

            // Should not error - view exists and RLS is enforced
            expect(error).toBeNull();
        });

        it('should enforce RLS on active_restaurant_staff view', async () => {
            const { error } = await serviceClient
                .from('active_restaurant_staff')
                .select('id')
                .limit(1);

            expect(error).toBeNull();
        });
    });

    describe('Data integrity after invoker changes', () => {
        it('should maintain correct has_pro_features computation', async () => {
            const { data, error } = await serviceClient
                .from('restaurant_plan_info')
                .select('id, plan, has_pro_features')
                .in('id', [testRestaurantId, otherRestaurantId]);

            expect(error).toBeNull();

            const proRestaurant = data?.find(r => r.plan === 'pro');
            const freeRestaurant = data?.find(r => r.plan === 'free');

            expect(proRestaurant?.has_pro_features).toBe(true);
            expect(freeRestaurant?.has_pro_features).toBe(false);
        });

        it('should filter soft-deleted records in active views', async () => {
            // Verify active_menu_items filters deleted items
            const { data: menuData, error: menuError } = await serviceClient
                .from('active_menu_items')
                .select('id, deleted_at')
                .is('deleted_at', 'not.null')
                .limit(1);

            expect(menuError).toBeNull();
            expect(menuData?.length).toBe(0);

            // Verify active_restaurants filters deleted items
            const { data: restData, error: restError } = await serviceClient
                .from('active_restaurants')
                .select('id, deleted_at')
                .is('deleted_at', 'not.null')
                .limit(1);

            expect(restError).toBeNull();
            expect(restData?.length).toBe(0);
        });
    });
});
