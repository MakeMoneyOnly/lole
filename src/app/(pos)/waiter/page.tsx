'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    Banknote,
    ChevronDown,
    Clock,
    Inbox,
    Plus,
    Printer,
    RotateCcw,
    Search,
    Trash2,
    User,
    Sun,
    Moon,
    CheckCircle2,
    AlertCircle,
    Loader2,
    UtensilsCrossed,
    ShoppingCart,
    ArrowRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { useManagedDeviceSession } from '@/features/merchant/hooks/useManagedDeviceSession';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';
import { formatCurrencyCompact } from '@/lib/utils/monetary';
import { logger } from '@/lib/logger';

import { useCart } from '@/context/CartContext';
import type { CartItem } from '@/domains/cart';

type RestaurantData = Database['public']['Tables']['restaurants']['Row'];
type CategoryData = Database['public']['Tables']['categories']['Row'];
type MenuItemData = Database['public']['Tables']['menu_items']['Row'];

export default function WaiterPosPage(): React.JSX.Element {
    const router = useRouter();
    const managedDevice = useManagedDeviceSession({
        route: '/waiter',
        expectedProfiles: ['waiter'],
    });

    const [staffSession, setStaffSession] = useState<{
        id: string;
        name: string;
        role: string;
        user_id: string;
        session_expires_at?: string;
    } | null>(null);
    const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
    const headerDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent): void {
            if (
                headerDropdownRef.current &&
                !headerDropdownRef.current.contains(event.target as Node)
            ) {
                setIsHeaderDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Enforce Staff PIN Session Guard
    useEffect(() => {
        const ctxStr = sessionStorage.getItem('gebata_waiter_context');
        if (ctxStr) {
            try {
                const parsed = JSON.parse(ctxStr) as {
                    id: string;
                    name: string;
                    role: string;
                    user_id: string;
                    session_expires_at?: string;
                };

                if (
                    parsed.session_expires_at &&
                    new Date(parsed.session_expires_at).getTime() <= Date.now()
                ) {
                    sessionStorage.removeItem('gebata_waiter_context');
                    router.replace(
                        `/waiter/pin?restaurantId=${managedDevice.session?.restaurant_id || ''}`
                    );
                    return;
                }

                setStaffSession(parsed);
            } catch (e) {
                logger.error('Invalid staff session structure, requiring PIN relogin.', e);
                router.replace(
                    `/waiter/pin?restaurantId=${managedDevice.session?.restaurant_id || ''}`
                );
            }
        } else if (managedDevice.session?.restaurant_id) {
            // Once device knows the restaurant but no staff session exists, lock the terminal.
            router.replace(`/waiter/pin?restaurantId=${managedDevice.session.restaurant_id}`);
        }
    }, [router, managedDevice.session?.restaurant_id]);

    const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isLoadingRestaurant, setIsLoadingRestaurant] = useState(false);

    // Menu Data State
    const [categories, setCategories] = useState<CategoryData[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItemData[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | 'all'>('all');
    const [tables, setTables] = useState<Database['public']['Tables']['tables']['Row'][]>([]);
    const [isLoadingMenu, setIsLoadingMenu] = useState(false);

    const [orderType, _setOrderType] = useState<'Dine-in' | 'Takeaway' | 'Delivery'>('Dine-in');
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [_showOrderTypeDropdown, _setShowOrderTypeDropdown] = useState(false);
    const [_showTableDropdown, _setShowTableDropdown] = useState(false);

    const cart = useCart();

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch restaurant and menu data when session is available
    useEffect(() => {
        const restaurantId = managedDevice.session?.restaurant_id;
        if (!restaurantId) return;

        async function fetchData(): Promise<void> {
            setIsLoadingRestaurant(true);
            setIsLoadingMenu(true);
            try {
                const supabase = getSupabaseClient();

                // 1. Fetch Restaurant
                const { data: restData, error: restError } = await supabase
                    .from('restaurants')
                    .select('*')
                    .eq('id', restaurantId as string)
                    .single();

                if (restData && !restError) {
                    setRestaurant(restData);
                }

                // 2. Fetch Categories
                const { data: catsData, error: catsError } = await supabase
                    .from('categories')
                    .select('*')
                    .eq('restaurant_id', restaurantId as string)
                    .order('order_index', { ascending: true });

                if (catsData && !catsError) {
                    setCategories(catsData);

                    // 3. Fetch Items for these categories
                    if (catsData.length > 0) {
                        const { data: itemsData, error: itemsError } = await supabase
                            .from('menu_items')
                            .select('*')
                            .in(
                                'category_id',
                                catsData.map(c => c.id)
                            );

                        if (itemsData && !itemsError) {
                            setMenuItems(itemsData);
                        }
                    }

                    // 4. Fetch Tables
                    const { data: tablesData, error: tablesError } = await supabase
                        .from('tables')
                        .select('*')
                        .eq('restaurant_id', restaurantId as string);

                    if (tablesData && !tablesError) {
                        setTables(tablesData);
                        if (tablesData.length > 0 && !selectedTableId) {
                            setSelectedTableId(tablesData[0].id);
                        }
                    }
                }
            } catch (err) {
                logger.error('Error fetching data for POS:', err);
            } finally {
                setIsLoadingRestaurant(false);
                setIsLoadingMenu(false);
            }
        }

        void fetchData();
    }, [managedDevice.session?.restaurant_id, selectedTableId]);

    const _formattedDate = useMemo(() => {
        return format(currentTime, "EEEE, d MMM yyyy 'at' p.");
    }, [currentTime]);

    const [searchTerm, setSearchTerm] = useState('');
    const [_showFireMenu, _setShowFireMenu] = useState(false);
    const [showSplitPayment, setShowSplitPayment] = useState(false);
    const [_payFlow, _setPayFlow] = useState<
        'MODE_SELECT' | 'SINGLE_QR' | 'SPLIT_AVATARS' | 'SPLIT_QR'
    >('MODE_SELECT');
    const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID'>('PENDING');
    const [_isGuestMode, _setIsGuestMode] = useState(false);
    const [_activeGuestId, _setActiveGuestId] = useState(1);
    const [_guestList, _setGuestList] = useState([
        { id: 1, name: 'Guest 1', color: 'bg-blue-100', paid: false },
        { id: 2, name: 'Guest 2', color: 'bg-emerald-100', paid: false },
    ]);
    const [splitMode, setSplitMode] = useState<'full' | 'split'>('full');
    const [_splitCount, _setSplitCount] = useState(2);

    const filteredItems = useMemo(() => {
        return menuItems.filter(item => {
            const matchesCategory =
                selectedCategoryId === 'all' || item.category_id === selectedCategoryId;
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [menuItems, selectedCategoryId, searchTerm]);

    const groupedCartItems = useMemo(() => {
        const groups: Record<string, CartItem[]> = {};
        cart.items.forEach(item => {
            const course = item.course || 'Food';
            if (!groups[course]) groups[course] = [];
            groups[course].push(item);
        });
        return groups;
    }, [cart.items]);

    const totalWithTax = cart.total * 1.15;

    if (managedDevice.hasProfileMismatch) {
        return (
            <div className="font-inter flex min-h-screen items-center justify-center bg-[#F7F5F2] p-6 tracking-[-0.04em]">
                <div className="max-w-md rounded-[2.5rem] border border-gray-100 bg-white p-12 text-center">
                    <AlertCircle className="mx-auto mb-6 h-12 w-12 text-red-500" />
                    <h1 className="text-3xl font-bold tracking-tight text-[#1A1C1E]">
                        Wrong Device Role.
                    </h1>
                    <p className="mt-4 leading-relaxed font-medium text-gray-500">
                        This tablet is paired for a different workspace. Re-provision it as a waiter
                        device to access tableside service tools.
                    </p>
                </div>
            </div>
        );
    }

    if (managedDevice.isIdentityRevoked || !managedDevice.hasOutageAccess) {
        return (
            <div className="font-inter flex min-h-screen items-center justify-center bg-[#F7F5F2] p-6 tracking-[-0.04em]">
                <div className="max-w-md rounded-[2.5rem] border border-gray-100 bg-white p-12 text-center">
                    <AlertCircle className="mx-auto mb-6 h-12 w-12 text-amber-500" />
                    <h1 className="text-3xl font-bold tracking-tight text-[#1A1C1E]">
                        Device Paused.
                    </h1>
                    <p className="mt-4 leading-relaxed font-medium text-gray-500">
                        {managedDevice.isIdentityRevoked
                            ? 'This waiter device identity was revoked. Re-pair it before continuing.'
                            : (managedDevice.outageAccess.reason ??
                              'This waiter device needs fresh online authorization.')}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="font-inter flex h-screen overflow-hidden bg-[#F7F5F2] tracking-[-0.04em] text-[#1A1C1E] antialiased">
            {/* Main Wrapper */}
            <main className="flex min-w-0 flex-1 flex-col">
                {/* Top Bar */}
                <header className="relative z-40 flex h-24 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-10">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-4">
                            {restaurant?.logo_url ? (
                                <Image
                                    src={restaurant.logo_url}
                                    alt={restaurant.name}
                                    width={40}
                                    height={40}
                                    className="h-10 w-10 rounded-xl border border-gray-100 object-cover"
                                />
                            ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F5F2] text-xs font-bold text-[#1A1C1E]">
                                    {restaurant?.name?.charAt(0) || 'R'}
                                </div>
                            )}
                            <div>
                                <h1 className="mb-1 text-lg leading-none font-bold">
                                    {isLoadingRestaurant
                                        ? 'Syncing...'
                                        : restaurant?.name || 'Lole Enterprise'}
                                </h1>
                                <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                                    Terminal / {managedDevice.session?.name || 'Local'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex h-12 items-center gap-3 rounded-xl border border-emerald-100/50 bg-emerald-50 px-5 text-emerald-600">
                            <Banknote className="h-4 w-4" />
                            <span className="text-sm font-bold">0.00 Br. Tips</span>
                        </div>

                        <div className="flex h-12 items-center gap-3 rounded-xl border border-gray-100 bg-[#F7F5F2] px-5 text-gray-500">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm font-bold tabular-nums">
                                {format(currentTime, 'p')}
                            </span>
                        </div>

                        <div className="mx-2 h-8 w-px bg-gray-100" />

                        <div className="relative" ref={headerDropdownRef}>
                            <button
                                onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                                className="flex h-12 cursor-pointer items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 text-left transition-all hover:bg-gray-50"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A1C1E] text-[#DDF853]">
                                    <User className="h-4 w-4" />
                                </div>
                                <div className="hidden sm:block">
                                    <p className="mb-1 text-[10px] leading-none font-black tracking-widest text-gray-400 uppercase">
                                        Staff
                                    </p>
                                    <p className="text-sm leading-none font-bold text-[#1A1C1E]">
                                        {staffSession?.name || 'Waitstaff'}
                                    </p>
                                </div>
                                <ChevronDown
                                    className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isHeaderDropdownOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {isHeaderDropdownOpen && (
                                <div className="animate-in fade-in zoom-in-95 absolute top-[calc(100%+12px)] right-0 z-[100] w-64 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl">
                                    <div className="space-y-4 p-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                                                Theme
                                            </span>
                                            <div className="flex items-center gap-1 rounded-lg bg-[#F7F5F2] p-1">
                                                <button className="rounded-md border border-gray-100 bg-white p-1.5 text-[#1A1C1E]">
                                                    <Sun className="h-3.5 w-3.5" />
                                                </button>
                                                <button className="rounded-md p-1.5 text-gray-400">
                                                    <Moon className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                sessionStorage.removeItem('gebata_waiter_context');
                                                setIsHeaderDropdownOpen(false);
                                                router.replace(
                                                    `/waiter/pin?restaurantId=${managedDevice.session?.restaurant_id || ''}`
                                                );
                                            }}
                                            className="flex w-full items-center gap-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                            Logout & Lock
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content Area */}
                <div className="relative flex flex-1 overflow-hidden">
                    {/* Menu Grid Section */}
                    <div className="no-scrollbar relative flex flex-1 flex-col gap-10 overflow-y-auto p-10">
                        {/* Filters & Search */}
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-8 w-1.5 rounded-full bg-[#DDF853]" />
                                    <h2 className="text-3xl font-bold text-[#1A1C1E]">Menu.</h2>
                                </div>

                                <div className="no-scrollbar flex max-w-[60%] items-center gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-1.5">
                                    <button
                                        onClick={() => setSelectedCategoryId('all')}
                                        className={`rounded-xl px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all ${
                                            selectedCategoryId === 'all'
                                                ? 'bg-[#1A1C1E] text-white'
                                                : 'text-gray-400 hover:text-[#1A1C1E]'
                                        }`}
                                    >
                                        All Items
                                    </button>
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategoryId(cat.id)}
                                            className={`rounded-xl px-5 py-2.5 text-sm font-bold whitespace-nowrap transition-all ${
                                                selectedCategoryId === cat.id
                                                    ? 'bg-[#1A1C1E] text-white'
                                                    : 'text-gray-400 hover:text-[#1A1C1E]'
                                            }`}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="group relative flex-1">
                                    <Search className="absolute top-1/2 left-5 h-5 w-5 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-[#1A1C1E]" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Search menu items..."
                                        className="h-16 w-full rounded-2xl border border-gray-100 bg-white pr-6 pl-14 text-lg font-medium transition-all focus:border-[#DDF853] focus:outline-none"
                                    />
                                </div>
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setSelectedCategoryId('all');
                                    }}
                                    className="flex h-16 items-center gap-3 rounded-2xl border border-gray-100 bg-white px-8 text-sm font-bold transition-colors hover:bg-gray-50"
                                >
                                    <RotateCcw className="h-4 w-4 text-gray-400" />
                                    Reset
                                </button>
                            </div>
                        </div>

                        {/* Item Grid */}
                        <div className="grid grid-cols-2 gap-6 pb-10 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                            {isLoadingMenu ? (
                                <div className="col-span-full flex h-64 items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                                </div>
                            ) : filteredItems.length === 0 ? (
                                <div className="col-span-full flex h-64 flex-col items-center justify-center gap-4 text-center text-gray-300">
                                    <Inbox className="h-12 w-12" />
                                    <p className="text-xl font-bold">No dishes found.</p>
                                </div>
                            ) : (
                                filteredItems.map(item => {
                                    const inCart = cart.items.find(i => i.menuItemId === item.id);
                                    const quantity = inCart?.quantity || 0;

                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() =>
                                                cart.addToCart({
                                                    menuItemId: item.id,
                                                    title: item.name,
                                                    price: item.price / 100,
                                                    quantity: 1,
                                                    image: item.image_url || undefined,
                                                    course: item.course || 'Food',
                                                })
                                            }
                                            className={`group relative flex flex-col overflow-hidden rounded-3xl border transition-all duration-300 ${
                                                quantity > 0
                                                    ? 'border-[#DDF853] bg-white'
                                                    : 'border-gray-100 bg-white hover:border-gray-200'
                                            }`}
                                        >
                                            {quantity > 0 && (
                                                <div className="absolute top-4 left-4 z-10 flex h-10 items-center justify-center rounded-xl bg-[#DDF853] px-4 text-xs font-black text-[#1A1C1E]">
                                                    {quantity}
                                                </div>
                                            )}
                                            <div className="aspect-[4/3] w-full overflow-hidden bg-[#F7F5F2]">
                                                {item.image_url ? (
                                                    <Image
                                                        src={item.image_url}
                                                        alt={item.name}
                                                        width={300}
                                                        height={225}
                                                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-gray-200">
                                                        <UtensilsCrossed className="h-10 w-10" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-1 flex-col p-6 text-left">
                                                <h3 className="mb-4 line-clamp-2 text-base font-bold text-[#1A1C1E]">
                                                    {item.name}
                                                </h3>
                                                <div className="mt-auto flex items-center justify-between">
                                                    <span className="text-xl font-black text-[#1A1C1E]">
                                                        {formatCurrencyCompact(item.price / 100)}
                                                    </span>
                                                    <div
                                                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                                                            quantity > 0
                                                                ? 'bg-[#1A1C1E] text-[#DDF853]'
                                                                : 'bg-[#F7F5F2] text-gray-400 group-hover:bg-[#DDF853] group-hover:text-[#1A1C1E]'
                                                        }`}
                                                    >
                                                        <Plus className="h-5 w-5" />
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Split Payment Modal Redesign */}
                        {showSplitPayment && (
                            <div className="animate-in fade-in fixed inset-0 z-[100] flex items-center justify-center bg-[#F7F5F2]/80 backdrop-blur-md duration-300">
                                <div
                                    className="w-full max-w-2xl space-y-10 rounded-[2.5rem] border border-gray-100 bg-white p-12"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="flex flex-col items-center text-center">
                                        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F7F5F2] text-[#1A1C1E]">
                                            <Banknote className="h-8 w-8" />
                                        </div>
                                        <h3 className="text-3xl font-bold text-[#1A1C1E]">
                                            Settlement.
                                        </h3>
                                        <p className="mt-2 font-medium text-gray-500">
                                            Select how you want to process this order.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <button
                                            onClick={() => setSplitMode('full')}
                                            className={`flex h-32 flex-col items-center justify-center gap-2 rounded-3xl border-2 transition-all ${
                                                splitMode === 'full'
                                                    ? 'border-[#1A1C1E] bg-[#1A1C1E] text-white'
                                                    : 'border-gray-50 bg-[#F7F5F2] text-gray-400 hover:border-gray-200'
                                            }`}
                                        >
                                            <span className="text-xl font-bold">Pay in Full</span>
                                            <span className="text-[10px] font-black tracking-widest uppercase opacity-60">
                                                Standard Checkout
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => setSplitMode('split')}
                                            className={`flex h-32 flex-col items-center justify-center gap-2 rounded-3xl border-2 transition-all ${
                                                splitMode === 'split'
                                                    ? 'border-[#1A1C1E] bg-[#1A1C1E] text-white'
                                                    : 'border-gray-50 bg-[#F7F5F2] text-gray-400 hover:border-gray-200'
                                            }`}
                                        >
                                            <span className="text-xl font-bold">Split Bill</span>
                                            <span className="text-[10px] font-black tracking-widest uppercase opacity-60">
                                                Divide by Guest
                                            </span>
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-gray-100 pt-8">
                                        <button
                                            onClick={() => setShowSplitPayment(false)}
                                            className="text-sm font-bold text-gray-400 hover:text-[#1A1C1E]"
                                        >
                                            Cancel Process
                                        </button>
                                        <button
                                            onClick={() => setPaymentStatus('PAID')}
                                            className="h-16 rounded-2xl bg-[#DDF853] px-10 text-sm font-black tracking-widest text-[#1A1C1E] uppercase shadow-xl shadow-[#DDF853]/10 transition-all hover:scale-105 active:scale-95"
                                        >
                                            Complete Settlement
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Sidebar: Order Summary */}
                    <aside className="relative flex w-[520px] shrink-0 flex-col border-l border-gray-100 bg-white">
                        <div className="flex h-full flex-col">
                            {/* Header */}
                            <div className="border-b border-gray-100 p-10">
                                <div className="mb-10 flex items-center justify-between">
                                    <div>
                                        <p className="mb-1 text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">
                                            POS Terminal
                                        </p>
                                        <h2 className="text-4xl font-bold text-[#1A1C1E]">
                                            Order Details.
                                        </h2>
                                    </div>
                                    <div className="flex h-12 items-center gap-3 rounded-xl border border-gray-100 bg-[#F7F5F2] px-5">
                                        <div className="h-2 w-2 animate-pulse rounded-full bg-[#DDF853]" />
                                        <span className="text-sm font-bold text-[#1A1C1E]">
                                            Live Sync
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1 rounded-2xl border border-gray-100 bg-[#F7F5F2] p-5">
                                        <p className="mb-3 text-[10px] font-black tracking-widest text-gray-400 uppercase">
                                            Service Type
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-lg font-bold text-[#1A1C1E]">
                                                {orderType}
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-gray-400" />
                                        </div>
                                    </div>
                                    <div className="flex-1 rounded-2xl border border-gray-100 bg-[#F7F5F2] p-5">
                                        <p className="mb-3 text-[10px] font-black tracking-widest text-gray-400 uppercase">
                                            Table Location
                                        </p>
                                        <div className="flex items-center justify-between">
                                            <span className="text-lg font-bold text-[#1A1C1E]">
                                                {tables.find(t => t.id === selectedTableId)
                                                    ?.table_number || 'None'}
                                            </span>
                                            <ChevronDown className="h-4 w-4 text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Order Items */}
                            <div className="no-scrollbar flex-1 overflow-y-auto px-10 py-10">
                                {Object.entries(groupedCartItems).map(([course, items]) => (
                                    <div key={course} className="mb-12 last:mb-0">
                                        <h3 className="mb-8 border-b border-gray-50 pb-4 text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase">
                                            {course}
                                        </h3>
                                        <div className="space-y-8">
                                            {items.map(item => (
                                                <div
                                                    key={item.uniqueId}
                                                    className="group flex items-start gap-6"
                                                >
                                                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-[#F7F5F2]">
                                                        {item.image ? (
                                                            <Image
                                                                src={item.image}
                                                                alt={item.title}
                                                                width={80}
                                                                height={80}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center text-gray-300">
                                                                <UtensilsCrossed className="h-8 w-8" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="truncate text-lg font-bold text-[#1A1C1E]">
                                                            {item.title}
                                                        </h4>
                                                        <div className="mt-1 flex items-center gap-3">
                                                            <span className="text-sm font-black text-[#DDF853]">
                                                                {formatCurrencyCompact(item.price)}
                                                            </span>
                                                            <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
                                                                per unit
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-3">
                                                        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-[#F7F5F2] p-1.5">
                                                            <button
                                                                onClick={() =>
                                                                    cart.removeFromCart(
                                                                        item.uniqueId
                                                                    )
                                                                }
                                                                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-red-50 hover:text-red-500"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                            <span className="w-10 text-center text-lg font-black text-[#1A1C1E]">
                                                                {item.quantity}
                                                            </span>
                                                            <button
                                                                onClick={() =>
                                                                    cart.addToCart({
                                                                        ...item,
                                                                        quantity: 1,
                                                                    })
                                                                }
                                                                className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-white hover:text-[#1A1C1E]"
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {cart.items.length === 0 && (
                                    <div className="flex h-full flex-col items-center justify-center py-20 text-center opacity-30 grayscale">
                                        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[#F7F5F2]">
                                            <ShoppingCart className="h-10 w-10 text-gray-400" />
                                        </div>
                                        <p className="text-lg font-bold text-gray-400">
                                            Order is empty.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Summary Area */}
                            <div className="border-t border-gray-100 bg-[#F7F5F2]/50 p-10">
                                <div className="mb-10 space-y-5">
                                    <div className="flex items-center justify-between font-medium text-gray-400">
                                        <span>Subtotal</span>
                                        <span className="font-bold text-[#1A1C1E] tabular-nums">
                                            {formatCurrencyCompact(cart.total)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between font-medium text-gray-400">
                                        <span>Tax (15.0%)</span>
                                        <span className="font-bold text-[#1A1C1E] tabular-nums">
                                            {formatCurrencyCompact(cart.total * 0.15)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-gray-200 pt-6">
                                        <span className="text-2xl font-bold text-[#1A1C1E]">
                                            Total Amount.
                                        </span>
                                        <span className="text-4xl font-black tracking-tighter text-[#1A1C1E] tabular-nums">
                                            {formatCurrencyCompact(totalWithTax)}
                                        </span>
                                    </div>
                                </div>

                                <button
                                    disabled={cart.items.length === 0}
                                    onClick={() => setShowSplitPayment(true)}
                                    className="flex h-24 w-full items-center justify-center gap-4 rounded-[2.5rem] bg-[#1A1C1E] text-xl font-black tracking-widest text-[#DDF853] uppercase shadow-2xl shadow-black/10 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:grayscale"
                                >
                                    Review & Settle
                                    <ArrowRight className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>

            {/* Success Overlay */}
            {paymentStatus === 'PAID' && (
                <div className="animate-in fade-in fixed inset-0 z-[200] flex items-center justify-center bg-white duration-1000">
                    <div className="flex max-w-2xl flex-col items-center gap-16 px-10 text-center">
                        <div className="relative">
                            <div className="flex h-56 w-56 items-center justify-center rounded-[3.5rem] bg-[#F7F5F2]">
                                <div className="flex h-36 w-36 items-center justify-center rounded-full bg-[#DDF853] shadow-xl shadow-[#DDF853]/20">
                                    <CheckCircle2
                                        className="h-20 w-20 text-[#1A1C1E]"
                                        strokeWidth={2.5}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h2 className="text-6xl font-black tracking-tighter text-[#1A1C1E]">
                                Success.
                            </h2>
                            <p className="mx-auto max-w-md text-xl leading-relaxed font-medium text-gray-500">
                                The transaction was authorized and the order has been synchronized
                                with the main terminal.
                            </p>
                        </div>

                        <div className="grid w-full grid-cols-2 gap-6">
                            <button className="flex h-24 items-center justify-center gap-4 rounded-[2rem] bg-[#1A1C1E] text-sm font-black tracking-widest text-white uppercase transition-all hover:scale-[1.02] active:scale-[0.98]">
                                <Printer className="h-5 w-5 text-[#DDF853]" />
                                Print Receipt
                            </button>
                            <button
                                onClick={() => {
                                    setPaymentStatus('PENDING');
                                    cart.clearCart();
                                }}
                                className="h-24 rounded-[2rem] bg-[#F7F5F2] text-sm font-black tracking-widest text-[#1A1C1E] uppercase transition-all hover:scale-[1.02] hover:bg-gray-100 active:scale-[0.98]"
                            >
                                Start New Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}



