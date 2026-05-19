'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useParams, useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { isAbortError } from '@/hooks/useSafeFetch';
import type { CartItem } from '@/domains/cart';

// ─── Types ───────────────────────────────────────────────────────────────────

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

export interface Category {
    id: string;
    name: string;
}

export interface MenuItem {
    id: string;
    name: string;
    title: string;
    imageUrl: string | null;
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

// ─── Data Hook ───────────────────────────────────────────────────────────────

/**
 * All data-fetching and session state for the guest menu.
 * Expose this hook to any new UI component tree via context or prop-drilling.
 */
interface GuestMenuData {
    selectedItem: MenuItem | null;
    setSelectedItem: (item: MenuItem | null) => void;
    cartOpen: boolean;
    setCartOpen: (open: boolean) => void;
    paymentReturnSuccess: boolean;
    paymentReturnOrderId: string | null;
    loading: boolean;
    contextLoading: boolean;
    contextError: string | null;
    activeTab: 'food' | 'drinks';
    setActiveTab: (tab: 'food' | 'drinks') => void;
    activeCategoryId: string;
    setActiveCategoryId: (id: string) => void;
    realItems: MenuItem[];
    filteredItems: MenuItem[];
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    guestContext: GuestContextPayload | null;
    guestSessionId: string | null;
    authState: 'guest' | 'authenticated';
    showPreMenuSplash: boolean;
    setShowPreMenuSplash: (show: boolean) => void;
    isOnlineOrderMode: boolean;
    cartCount: number;
    slug: string;
    handleAddToCart: (item: MenuItem, quantity?: number) => void;
    cartItems: CartItem[];
    handleRemoveFromCart: (itemId: string) => void;
    handleUpdateQuantity: (itemId: string, quantity: number) => void;
}

export function useGuestMenuData(): GuestMenuData {
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
    const [searchQuery, setSearchQuery] = useState('');
    const [_sessionSyncing, setSessionSyncing] = useState(false);

    const params = useParams<{ slug: string }>();
    const searchParams = useSearchParams();

    const getQueryParam = (key: string): string | null => searchParams.get(key) ?? searchParams.get(`amp;${key}`);
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
    const { addToCart, count, items, removeFromCart, updateQuantity } = useCart();

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

        async function validateContext(): Promise<void> {
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
        async function upsertGuestSession(): Promise<void> {
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
                    void payload?.error;
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
                    void error;
                }
            } finally {
                setSessionSyncing(false);
            }
        }

        void upsertGuestSession();
    }, [campaignDeliveryId, forceMenuEntry, guestContext, guestSessionId]);

    // ── Menu fetch ────────────────────────────────────────────────────────────
    useEffect(() => {
        async function fetchMenu(): Promise<void> {
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
                    void categoryError;
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
                    void itemError;
                    setRealItems([]);
                    return;
                }

                const getSmartImageUrl = (path: string | null): string | null => {
                    if (!path || path.trim() === '') return null;
                    if (path.startsWith('fab')) return path;
                    if (isAllowedRemoteImageUrl(path)) return path;
                    const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
                    return data.publicUrl;
                };

                const formattedItems = ((items as RawMenuItem[]) || [])
                    .map((item: RawMenuItem): MenuItem | null => {
                        const category = categoryById.get(item.category_id);
                        if (!category) return null;

                        const imageUrl = getSmartImageUrl(item.image_url);

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
                void error;
                setRealItems([]);
            } finally {
                setLoading(false);
            }
        }

        void fetchMenu();
    }, [guestContext?.restaurant_id, guestContext?.restaurant_name, showPreMenuSplash, supabase]);

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

        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        if (activeCategoryId === 'all') return true;
        return item.categories?.name?.toLowerCase() === activeCategoryId.toLowerCase();
    });

    const handleAddToCart = (item: MenuItem, quantity = 1): void => {
addToCart({
             menuItemId: item.id,
             title: item.title,
             price: item.price,
             image: item.imageUrl ?? undefined,
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
        searchQuery,
        setSearchQuery,
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
        cartItems: items,
        handleRemoveFromCart: removeFromCart,
        handleUpdateQuantity: updateQuantity,
    };
}

// ─── Page Shell ───────────────────────────────────────────────────────────────

import { GuestMenuHeader } from '@/components/guest-menu/GuestMenuHeader';
import { GuestMenuSearchBar } from '@/components/guest-menu/GuestMenuSearchBar';
import { GuestMenuProductGrid } from '@/components/guest-menu/GuestMenuProductCard';
import { GuestMenuBottomNav } from '@/components/guest-menu/GuestMenuBottomNav';
import { GuestMenuCart } from '@/components/guest-menu/GuestMenuCart';
import { GuestMenuProfile } from '@/components/guest-menu/GuestMenuProfile';
import { GuestMenuFeaturedSpecialsCarousel } from '@/components/guest-menu/GuestMenuFeaturedSpecialsCarousel';
import { QuickActionsGrid } from '@/components/guest-menu/QuickActions';
import Image from 'next/image';

/**
 * MenuClientContent — blank canvas.
 * The old UI has been removed. Build the new design here.
 */
export function MenuClientContent(): React.JSX.Element {
    const data = useGuestMenuData();
    const [activeIndex, setActiveIndex] = useState(0);

    // Loading / error boundary stubs — replace with new design components.
    if (data.contextLoading) {
        return (
            <div className="flex min-h-screen w-full items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-black border-t-transparent" />
                    <p className="text-sm font-medium text-black/40">Preparing your menu...</p>
                </div>
            </div>
        );
    }

    if (data.contextError) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center bg-white px-4 text-center">
                <p className="text-red-500 font-medium">{data.contextError}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 rounded-xl bg-black px-6 py-2 text-sm font-medium text-white"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (!data.guestContext) {
        return (
            <div className="flex min-h-screen w-full flex-col items-center justify-center bg-white px-4 text-center">
                <p className="text-yellow-600 font-medium">Invalid or expired link.</p>
                <p className="mt-2 text-sm text-black/40">Please scan the table QR code again.</p>
            </div>
        );
    }

    const handleNavChange = (_index: number): void => {
        setActiveIndex(_index);
    };

    // ── Screen Rendering ─────────────────────────────────────────────────────
    const renderScreen = (): React.JSX.Element => {
        switch (activeIndex) {
            case 3: // Cart
                return (
                    <GuestMenuCart
                        cartItems={data.cartItems}
                        onBack={() => setActiveIndex(0)}
                        onUpdateQuantity={data.handleUpdateQuantity}
                        onRemove={data.handleRemoveFromCart}
                        onCheckout={(): void => {
                            // TODO: Implement checkout
                        }}
                    />
                );
            case 2: // Profile
                return <GuestMenuProfile onLogout={(): void => {
                    // TODO: Implement logout
                }} />;
            case 0: // Home
            default:
                return (
                    <div className="mx-auto max-w-md bg-white min-h-screen">
                        {/* DARK HERO SECTION WITH ROUNDED BOTTOM */}
                        <div className="relative z-20 overflow-hidden rounded-b-[28px] bg-[#1A1A1A] pb-4 shadow-xl shadow-black/10">
                            {/* Background Texture Placeholder */}
                            <div className="absolute inset-0 z-0">
                                <Image
                                    src="https://res.cloudinary.com/dcm6m7d81/image/upload/v1778940507/50_off_2_xl1b5b.png"
                                    alt="Hero Image"
                                    fill
                                    className="object-cover"
                                />
                            </div>

                            <div className="relative z-10">
                                <GuestMenuHeader />

                                {/* HORIZONTAL TEXT FILTERS */}
                                <div className="flex w-full items-center gap-6 overflow-x-auto px-5 py-2 no-scrollbar">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[14px] font-bold text-white tracking-[-0.04em] whitespace-nowrap">Home</span>
                                        <div className="mt-1 h-0.5 w-full bg-white rounded-full" />
                                    </div>
                                    <span className="text-[14px] font-semibold text-white/60 tracking-[-0.04em] whitespace-nowrap">Burgers</span>
                                    <span className="text-[14px] font-semibold text-white/60 tracking-[-0.04em] whitespace-nowrap">Pizza</span>
                                    <span className="text-[14px] font-semibold text-white/60 tracking-[-0.04em] whitespace-nowrap">Sushi</span>
                                    <span className="text-[14px] font-semibold text-white/60 tracking-[-0.04em] whitespace-nowrap">Drinks</span>
                                    <span className="text-[14px] font-semibold text-white/60 tracking-[-0.04em] whitespace-nowrap">Desserts</span>
                                </div>

                                {/* SPACER FOR HEIGHT */}
                                <div className="h-32" />

                                {/* SEARCH BAR */}
                                <GuestMenuSearchBar
                                    value={data.searchQuery}
                                    onChange={data.setSearchQuery}
                                />
                            </div>
                        </div>

                        {/* CONTENT SECTION (NOW FLAT TOP) */}
                        <div className="relative z-10 bg-white pt-4 pb-32">
                            {/* QUICK ACTIONS ROW */}
                            <QuickActionsGrid isOnlineOrderMode={data.isOnlineOrderMode} />

                            {/* FEATURED SPECIALS */}
                            <section className="mt-4">
                                <div className="mb-4 px-5 flex items-end justify-between">
                                    <h2 className="text-[26px] font-bold text-[#1A1C1E] tracking-[-0.04em] leading-none">
                                        Featured specials
                                    </h2>
                                    <button className="text-[13px] font-semibold text-[#A3A3A3] hover:text-black/60 tracking-[-0.04em] transition-colors pb-0.5">
                                        See all
                                    </button>
                                </div>

                                <GuestMenuFeaturedSpecialsCarousel
                                    items={data.filteredItems.slice(0, 5)}
                                    onSelect={data.setSelectedItem}
                                    onAddToCart={data.handleAddToCart}
                                />
                            </section>

                            {/* MORE FOR YOU (GRID) */}
                            <section className="mt-10">
                                <div className="mb-4 px-5 flex items-end justify-between">
                                    <h2 className="text-[26px] font-bold text-[#1A1C1E] tracking-[-0.04em] leading-none">
                                        More for You
                                    </h2>
                                    <button className="text-[13px] font-semibold text-[#A3A3A3] hover:text-black/60 tracking-[-0.04em] transition-colors pb-0.5">
                                        View All
                                    </button>
                                </div>
                                <GuestMenuProductGrid
                                    items={data.filteredItems}
                                    onAddToCart={data.handleAddToCart}
                                    onSelect={data.setSelectedItem}
                                />
                            </section>
                        </div>
                    </div>
                );
        }
    };

    const cartCount = data.cartItems?.reduce((acc: number, curr: CartItem) => acc + (curr.quantity || 0), 0) || 0;

    return (
        <main className="min-h-screen w-full bg-[#FFFFFF] pb-32 font-inter">
            {renderScreen()}

            {/* Cloned Bottom Navigation Bar */}
            <GuestMenuBottomNav
                activeIndex={activeIndex}
                onIndexChange={handleNavChange}
                isOnlineOrderMode={data.isOnlineOrderMode}
                cartCount={cartCount}
            />
        </main>
    );
}
