'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { CartProvider, useCart } from '@/context/CartContext';
import { FOOD_ITEMS } from '@/lib/constants';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────────────────

const FALLBACK_IMAGE_URL =
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop';
const ALLOWED_REMOTE_IMAGE_HOSTS = new Set([
    'via.placeholder.com',
    'axuegixbqsvztdraenkz.supabase.co',
    'images.unsplash.com',
    'plus.unsplash.com',
    'res.cloudinary.com',
    'i.pravatar.cc',
    'api.dicebear.com',
]);

function tryParseHttpsUrl(value: string): URL | null {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' ? parsed : null;
    } catch {
        return null;
    }
}

function isAllowedRemoteImageUrl(value: string): boolean {
    const parsed = tryParseHttpsUrl(value);
    if (!parsed) return false;
    const hostname = parsed.hostname.toLowerCase();
    return ALLOWED_REMOTE_IMAGE_HOSTS.has(hostname) || hostname.endsWith('.supabase.co');
}

interface RawCategory {
    id: string;
    name: string;
    section: 'food' | 'drinks';
}

interface RawMenuItem {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
    rating: number | null;
    preparation_time: number | null;
    description: string | null;
    description_am: string | null;
    popularity: number | null;
    likes_count: number | null;
    category_id: string;
}

export interface MenuItem {
    id: string;
    name: string;
    title: string;
    imageUrl: string;
    preparationTime: number;
    shopName: string;
    price: number;
    rating?: number;
    categories: { name: string; section: 'food' | 'drinks' };
    description?: string;
    description_am?: string;
    popularity?: number;
    likesCount?: number;
}

// Demo context for bypassing QR validation
const DEMO_CONTEXT = {
    restaurant_id: 'demo-restaurant',
    table: '1',
    slug: 'demo-table',
    sig: '0'.repeat(64),
    exp: Date.now() + 86400000,
};

// ─── Data ─────────────────────────────────────────────────────────────────────

function DemoMenuContent(): React.JSX.Element {
    const [_loading, setLoading] = useState(true);
    const [_activeTab, _setActiveTab] = useState<'food' | 'drinks'>('food');
    const [_activeCategoryId, _setActiveCategoryId] = useState('all');
    const [realItems, setRealItems] = useState<MenuItem[]>([]);
    const { addToCart: _addToCart, count: _count } = useCart();

    useEffect(() => {
        async function fetchDemoMenu(): Promise<void> {
            setLoading(true);
            const supabase = createClient();

            try {
                const { data: lastItem } = await supabase
                    .from('menu_items')
                    .select('restaurant_id')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                let restaurantId = lastItem?.restaurant_id;
                let restaurants: { id: string; slug: string } | null = null;

                if (restaurantId) {
                    const { data } = await supabase
                        .from('restaurants')
                        .select('id, slug')
                        .eq('id', restaurantId)
                        .maybeSingle();
                    restaurants = data;
                } else {
                    const { data } = await supabase
                        .from('restaurants')
                        .select('id, slug')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    restaurants = data;
                    restaurantId = restaurants?.id;
                }

                if (!restaurantId || !restaurants) {
                    setRealItems([]);
                    setLoading(false);
                    return;
                }

                DEMO_CONTEXT.restaurant_id = restaurantId;
                if (restaurants.slug) DEMO_CONTEXT.slug = restaurants.slug;

                const { data: tableData } = await supabase
                    .from('tables')
                    .select('table_number')
                    .eq('restaurant_id', restaurantId)
                    .eq('is_active', true)
                    .limit(1)
                    .maybeSingle();

                DEMO_CONTEXT.table = tableData?.table_number ?? '1';

                const { data: categories, error: categoryError } = await supabase
                    .from('categories')
                    .select('id, name, section')
                    .eq('restaurant_id', restaurantId);

                if (categoryError) {
                    setRealItems([]);
                    return;
                }

                const typedCategories = (categories as RawCategory[]) ?? [];
                const categoryIds = typedCategories.map(c => c.id);
                const categoryById = new Map(typedCategories.map(c => [c.id, c]));

                if (categoryIds.length === 0) {
                    setRealItems([]);
                    return;
                }

                const { data: items, error: itemError } = await supabase
                    .from('menu_items')
                    .select(
                        'id, name, price, image_url, rating, preparation_time, description, description_am, popularity, likes_count, category_id'
                    )
                    .eq('is_available', true)
                    .in('category_id', categoryIds);

                if (itemError) {
                    setRealItems([]);
                    return;
                }

                const getSmartImageUrl = (path: string | null): string => {
                    if (!path) return FALLBACK_IMAGE_URL;
                    if (path.startsWith('fab')) return path;
                    if (isAllowedRemoteImageUrl(path)) return path;
                    const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
                    return data.publicUrl;
                };

                const formattedItems = ((items as RawMenuItem[]) || [])
                    .map((item: RawMenuItem): MenuItem | null => {
                        const category = categoryById.get(item.category_id);
                        if (!category) return null;

                        const constantItem = FOOD_ITEMS.find(
                            food =>
                                food.title.toLowerCase().trim() === item.name.toLowerCase().trim()
                        );

                        return {
                            id: item.id,
                            name: item.name,
                            title: item.name,
                            imageUrl: constantItem
                                ? constantItem.imageUrl
                                : getSmartImageUrl(item.image_url),
                            preparationTime: item.preparation_time || 15,
                            shopName: 'Saba Grill',
                            price: Number(item.price),
                            rating: item.rating ?? undefined,
                            categories: { name: category.name, section: category.section },
                            description: item.description ?? undefined,
                            description_am: item.description_am ?? undefined,
                            popularity: item.popularity ?? undefined,
                            likesCount: item.likes_count ?? undefined,
                        };
                    })
                    .filter((item): item is MenuItem => item !== null);

                setRealItems(formattedItems);
            } catch (error) {
                logger.error('Demo menu error', error);
                setRealItems([]);
            } finally {
                setLoading(false);
            }
        }

        fetchDemoMenu();
    }, []);

    const _filteredItems = realItems.filter(item => {
        if (item.categories?.section !== _activeTab) return false;
        if (_activeCategoryId === 'all') return true;
        return item.categories?.name?.toLowerCase() === _activeCategoryId.toLowerCase();
    });

    // ── Canvas ────────────────────────────────────────────────────────────────
    return (
        <main className="flex min-h-screen w-full items-center justify-center bg-[var(--background)]">
            {/*
             * ════════════════════════════════════════════════════
             *   BLANK CANVAS — DEMO TABLE DESIGN GOES HERE
             * ════════════════════════════════════════════════════
             *
             *  Available: loading, activeTab, setActiveTab,
             *             activeCategoryId, setActiveCategoryId,
             *             filteredItems, realItems, _count, _addToCart
             *             DEMO_CONTEXT (restaurant_id, table, slug)
             */}
            <p className="text-sm text-white/20 select-none">[ Demo Table — Design starts here ]</p>
        </main>
    );
}

export default function DemoTablePage(): React.JSX.Element {
    return (
        <CartProvider>
            <DemoMenuContent />
        </CartProvider>
    );
}
