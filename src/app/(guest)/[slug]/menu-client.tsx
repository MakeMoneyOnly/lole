'use client';

import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase';
import { useParams, useSearchParams } from 'next/navigation';
import { CartProvider, useCart } from '@/context/CartContext';
import { FOOD_ITEMS } from '@/lib/constants';
import { isAbortError } from '@/hooks/useSafeFetch';
import { isRemoteOrDataImageSrc } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

const FALLBACK_IMAGE_URL = 'https://via.placeholder.com/150';
const ALLOWED_REMOTE_IMAGE_HOSTS = new Set([
    'via.placeholder.com',
    'axuegixbqsvztdraenkz.supabase.co',
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

export interface GuestContextPayload {
    restaurant_id: string;
    table_id: string;
    table_number: string;
    slug: string;
    sig: string;
    exp: number;
    restaurant_name: string;
    restaurant_logo_url: string | null;
    is_online_order?: boolean;
}

interface CampaignAttributionPayload {
    campaign_delivery_id: string;
    campaign_id?: string;
}

// ─── Data Hook ───────────────────────────────────────────────────────────────

/**
 * All data-fetching and session state for the guest menu.
 * Expose this hook to any new UI component tree via context or prop-drilling.
 */
export function useGuestMenuData() {
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [cartOpen, setCartOpen] = useState(false);
    const [paymentReturnSuccess, setPaymentReturnSuccess] = useState(false);
    const [paymentReturnOrderId, setPaymentReturnOrderId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [contextLoading, setContextLoading] = useState(true);
    const [contextError, setContextError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'food' | 'drinks'>('food');
    const [activeCategoryId, setActiveCategoryId] = useState('all');
    const [realItems, setRealItems] = useState<MenuItem[]>([]);
    const [guestContext, setGuestContext] = useState<GuestContextPayload | null>(null);
    const [guestSessionId, setGuestSessionId] = useState<string | null>(null);
    const [authState, setAuthState] = useState<'guest' | 'authenticated'>('guest');
    const [showPreMenuSplash, setShowPreMenuSplash] = useState(true);
    const [_sessionSyncing, setSessionSyncing] = useState(false);

    const params = useParams<{ slug: string }>();
    const searchParams = useSearchParams();

    const getQueryParam = (key: string) => searchParams.get(key) ?? searchParams.get(`amp;${key}`);
    const tableNumber = getQueryParam('table');
    const signature = getQueryParam('sig');
    const expiresAt = getQueryParam('exp');
    const campaignDeliveryId = getQueryParam('cdid') ?? getQueryParam('campaign_delivery_id');
    const forceMenuEntry = getQueryParam('entry') === 'menu';
    const slug = params.slug;

    const isOnlineOrderMode = !tableNumber && !signature && !expiresAt;

    const paymentStatus = getQueryParam('payment');
    const paymentOrderId = getQueryParam('order_id');

    const supabase = useMemo(() => createClient(), []);
    const { addToCart, count } = useCart();

    // ── Payment return ────────────────────────────────────────────────────────
    useEffect(() => {
        if (paymentStatus === 'success') {
            setPaymentReturnSuccess(true);
            setPaymentReturnOrderId(paymentOrderId ?? null);
            setShowPreMenuSplash(false);
            setCartOpen(true);

            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.delete('payment');
            nextUrl.searchParams.delete('order_id');
            nextUrl.searchParams.delete('amp;payment');
            nextUrl.searchParams.delete('amp;order_id');
            window.history.replaceState({}, '', nextUrl.toString());
        }
    }, [paymentOrderId, paymentStatus]);

    const isMountedRef = useRef(true);

    // ── Context validation ────────────────────────────────────────────────────
    useEffect(() => {
        isMountedRef.current = true;

        async function validateContext() {
            if (isOnlineOrderMode) {
                setContextLoading(true);
                setContextError(null);
                try {
                    const url = new URL('/api/v1/guest-portal/restaurant', window.location.origin);
                    url.searchParams.set('slug', slug);

                    const response = await fetch(url.toString(), { method: 'GET' });
                    const payload = await response.json();

                    if (!isMountedRef.current) return;

                    if (!response.ok) {
                        setGuestContext(null);
                        setContextError(
                            payload?.error ?? 'Restaurant not found. Please check the URL.'
                        );
                        return;
                    }

                    const data = payload.data as {
                        restaurant_id: string;
                        restaurant_name: string;
                        restaurant_logo_url: string | null;
                        slug: string;
                    };

                    setGuestContext({
                        restaurant_id: data.restaurant_id,
                        table_id: '',
                        table_number: 'Online Order',
                        slug: data.slug,
                        sig: '0'.repeat(64),
                        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
                        restaurant_name: data.restaurant_name,
                        restaurant_logo_url: data.restaurant_logo_url,
                        is_online_order: true,
                    });
                    setShowPreMenuSplash(false);
                } catch (error) {
                    if (!isMountedRef.current) return;
                    if (isAbortError(error)) return;
                    setGuestContext(null);
                    setContextError('Unable to load restaurant. Please try again.');
                } finally {
                    if (isMountedRef.current) setContextLoading(false);
                }
                return;
            }

            if (!slug || !tableNumber || !signature || !expiresAt) {
                setGuestContext(null);
                setContextError('Invalid QR link. Please scan the table QR again.');
                setContextLoading(false);
                return;
            }

            setContextLoading(true);
            setContextError(null);

            try {
                const url = new URL('/api/v1/guest-portal/context', window.location.origin);
                url.searchParams.set('slug', slug);
                url.searchParams.set('table', tableNumber);
                url.searchParams.set('sig', signature);
                url.searchParams.set('exp', expiresAt);

                const response = await fetch(url.toString(), { method: 'GET' });
                const payload = await response.json();

                if (!isMountedRef.current) return;

                if (!response.ok) {
                    setGuestContext(null);
                    setContextError(payload?.error ?? 'Invalid or expired QR code.');
                    return;
                }

                setGuestContext(payload.data as GuestContextPayload);
            } catch (error) {
                if (!isMountedRef.current) return;
                if (isAbortError(error)) return;
                setGuestContext(null);
                setContextError('Unable to validate table context. Please try again.');
            } finally {
                if (isMountedRef.current) setContextLoading(false);
            }
        }

        void validateContext();

        return () => {
            isMountedRef.current = false;
        };
    }, [expiresAt, isOnlineOrderMode, signature, slug, supabase, tableNumber]);

    // ── Guest session upsert ──────────────────────────────────────────────────
    useEffect(() => {
        async function upsertGuestSession() {
            if (!guestContext || guestContext.is_online_order) return;

            setSessionSyncing(true);
            try {
                const response = await fetch('/api/v1/guest-portal/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: guestSessionId ?? undefined,
                        source: campaignDeliveryId ? 'campaign_qr' : 'qr',
                        guest_context: {
                            slug: guestContext.slug,
                            table: guestContext.table_number,
                            sig: guestContext.sig,
                            exp: guestContext.exp,
                        },
                    }),
                });

                const payload = await response.json();
                if (!response.ok) {
                    console.warn('Failed to upsert guest session:', payload?.error);
                    return;
                }

                const resolvedSessionId = payload?.data?.session_id as string | undefined;
                const resolvedAuthState = payload?.data?.auth_state as
                    | 'guest'
                    | 'authenticated'
                    | undefined;

                if (resolvedSessionId) setGuestSessionId(resolvedSessionId);
                if (resolvedAuthState) {
                    setAuthState(resolvedAuthState);
                    if (resolvedAuthState === 'authenticated' || forceMenuEntry) {
                        setShowPreMenuSplash(false);
                    }
                } else if (forceMenuEntry) {
                    setShowPreMenuSplash(false);
                }
            } catch (error) {
                if (!isAbortError(error)) {
                    console.error('Failed to sync guest session:', error);
                }
            } finally {
                setSessionSyncing(false);
            }
        }

        void upsertGuestSession();
    }, [campaignDeliveryId, forceMenuEntry, guestContext, guestSessionId]);

    // ── Menu fetch ────────────────────────────────────────────────────────────
    useEffect(() => {
        async function fetchMenu() {
            if (!guestContext?.restaurant_id || showPreMenuSplash) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const { data: categories, error: categoryError } = await supabase
                    .from('categories')
                    .select('id, name, section')
                    .eq('restaurant_id', guestContext.restaurant_id);

                if (categoryError) {
                    console.error('Error fetching categories:', categoryError);
                    setRealItems([]);
                    return;
                }

                const typedCategories =
                    (categories as RawCategory[])?.map(cat => ({
                        ...cat,
                        section: cat.section || 'food',
                    })) ?? [];
                const categoryIds = typedCategories.map(c => c.id);
                const categoryById = new Map(typedCategories.map(c => [c.id, c]));

                if (categoryIds.length === 0) {
                    setRealItems([]);
                    return;
                }

                const { data: items, error: itemError } = await supabase
                    .from('menu_items')
                    .select(
                        'id, name, price, image_url, rating, preparation_time, description, description_am, popularity, likes_count, category_id, is_available'
                    )
                    .in('category_id', categoryIds);

                if (itemError) {
                    console.error('Error fetching menu:', itemError);
                    setRealItems([]);
                    return;
                }

                const getSmartImageUrl = (path: string | null) => {
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

                        const imageUrl = constantItem
                            ? constantItem.imageUrl
                            : getSmartImageUrl(item.image_url);

                        return {
                            id: item.id,
                            name: item.name,
                            title: item.name,
                            imageUrl,
                            preparationTime: item.preparation_time || 15,
                            shopName: guestContext.restaurant_name || 'Lole Restaurant',
                            price: Number(item.price),
                            rating: item.rating ?? undefined,
                            categories: {
                                name: category.name,
                                section: category.section,
                            },
                            description: item.description ?? undefined,
                            description_am: item.description_am ?? undefined,
                            popularity: item.popularity ?? undefined,
                            likesCount: item.likes_count ?? undefined,
                        };
                    })
                    .filter((item): item is MenuItem => item !== null);

                setRealItems(formattedItems);
            } catch (error) {
                console.error('Unexpected menu error:', error);
                setRealItems([]);
            } finally {
                setLoading(false);
            }
        }

        void fetchMenu();
    }, [guestContext?.restaurant_id, showPreMenuSplash, supabase]);

    // ── Auth state change ────────────────────────────────────────────────────
    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event: string) => {
            if (event === 'SIGNED_OUT') {
                setAuthState('guest');
                setGuestSessionId(null);
            }
            if (event === 'SIGNED_IN') {
                setAuthState('authenticated');
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    const filteredItems = realItems.filter(item => {
        const matchesSection = item.categories?.section === activeTab;
        if (!matchesSection) return false;
        if (activeCategoryId === 'all') return true;
        return item.categories?.name?.toLowerCase() === activeCategoryId.toLowerCase();
    });

    const handleAddToCart = (item: MenuItem, quantity = 1) => {
        addToCart({
            menuItemId: item.id,
            title: item.title,
            price: item.price,
            image: item.imageUrl,
            quantity,
        });
    };

    return {
        // State
        selectedItem,
        setSelectedItem,
        cartOpen,
        setCartOpen,
        paymentReturnSuccess,
        paymentReturnOrderId,
        loading,
        contextLoading,
        contextError,
        activeTab,
        setActiveTab,
        activeCategoryId,
        setActiveCategoryId,
        realItems,
        filteredItems,
        guestContext,
        guestSessionId,
        authState,
        showPreMenuSplash,
        setShowPreMenuSplash,
        isOnlineOrderMode,
        cartCount: count,
        slug,
        // Actions
        handleAddToCart,
    };
}

// ─── Page Shell ───────────────────────────────────────────────────────────────

/**
 * MenuClientContent — blank canvas.
 * The old UI has been removed. Build the new design here.
 */
export function MenuClientContent() {
    const data = useGuestMenuData();

    // Loading / error boundary stubs — replace with new design components.
    if (data.contextLoading) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center bg-[var(--background)]">
                {/* TODO: new loading skeleton */}
                <p className="text-sm text-white/40">Loading…</p>
            </div>
        );
    }

    if (data.contextError) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[var(--background)] px-4 text-center">
                {/* TODO: new error state */}
                <p className="text-red-400">{data.contextError}</p>
            </div>
        );
    }

    if (!data.guestContext) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center bg-[var(--background)] px-4 text-center">
                {/* TODO: new invalid-link state */}
                <p className="text-yellow-400">Invalid or expired link.</p>
            </div>
        );
    }

    // ── Main menu canvas — build here ─────────────────────────────────────────
    return (
        <main className="min-h-screen w-full bg-[var(--background)]">
            {/*
             * ════════════════════════════════════════════════════
             *   BLANK CANVAS — NEW GUEST MENU DESIGN GOES HERE
             * ════════════════════════════════════════════════════
             *
             *  Available data:
             *    data.guestContext        → restaurant name, logo, table info
             *    data.filteredItems       → menu items for current tab/category
             *    data.realItems           → all loaded menu items
             *    data.activeTab           → 'food' | 'drinks'
             *    data.setActiveTab        → tab switcher
             *    data.activeCategoryId    → active category filter
             *    data.setActiveCategoryId → category filter setter
             *    data.loading             → menu loading state
             *    data.cartCount           → cart item count
             *    data.cartOpen            → cart drawer open state
             *    data.setCartOpen         → open/close cart
             *    data.handleAddToCart     → add item to cart
             *    data.selectedItem        → currently selected item
             *    data.setSelectedItem     → select / deselect item
             *    data.isOnlineOrderMode   → true for storefront, false for QR
             *    data.authState           → 'guest' | 'authenticated'
             *    data.showPreMenuSplash   → pre-menu splash flag
             *    data.setShowPreMenuSplash
             */}
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-white/20 select-none">
                    [ New Guest Menu — Design starts here ]
                </p>
            </div>
        </main>
    );
}
