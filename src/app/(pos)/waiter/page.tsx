'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    Banknote,
    Bell,
    BookOpen,
    Calendar,
    ChevronDown,
    Clock,
    Flame,
    Inbox,
    MessageSquare,
    PauseCircle,
    Pencil,
    Plus,
    Printer,
    RotateCcw,
    Search,
    Send,
    Trash2,
    User,
    Sun,
    Moon,
    X,
    CheckCircle2,
    AlertCircle,
    Loader2,
    UtensilsCrossed,
    ShoppingCart,
    ArrowRight,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';
import { useManagedDeviceSession } from '@/hooks/useManagedDeviceSession';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';
import { formatCurrencyCompact } from '@/lib/utils/monetary';

import { useCart, type CartItem } from '@/context/CartContext';

type RestaurantData = Database['public']['Tables']['restaurants']['Row'];
type CategoryData = Database['public']['Tables']['categories']['Row'];
type MenuItemData = Database['public']['Tables']['menu_items']['Row'];

export default function WaiterPosPage() {
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
        function handleClickOutside(event: MouseEvent) {
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
                console.error('Invalid staff session structure, requiring PIN relogin.', e);
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

    const [orderType, setOrderType] = useState<'Dine-in' | 'Takeaway' | 'Delivery'>('Dine-in');
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [showOrderTypeDropdown, setShowOrderTypeDropdown] = useState(false);
    const [showTableDropdown, setShowTableDropdown] = useState(false);

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

        async function fetchData() {
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
                console.error('Error fetching data for POS:', err);
            } finally {
                setIsLoadingRestaurant(false);
                setIsLoadingMenu(false);
            }
        }

        void fetchData();
    }, [managedDevice.session?.restaurant_id]);

    const formattedDate = useMemo(() => {
        return format(currentTime, "EEEE, d MMM yyyy 'at' p.");
    }, [currentTime]);

    const [searchTerm, setSearchTerm] = useState('');
    const [showFireMenu, setShowFireMenu] = useState(false);
    const [showSplitPayment, setShowSplitPayment] = useState(false);
    const [_payFlow, _setPayFlow] = useState<
        'MODE_SELECT' | 'SINGLE_QR' | 'SPLIT_AVATARS' | 'SPLIT_QR'
    >('MODE_SELECT');
    const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID'>('PENDING');
    const [_isGuestMode, _setIsGuestMode] = useState(false);
    const [activeGuestId, setActiveGuestId] = useState(1);
    const [_guestList, _setGuestList] = useState([
        { id: 1, name: 'Guest 1', color: 'bg-blue-100', paid: false },
        { id: 2, name: 'Guest 2', color: 'bg-emerald-100', paid: false },
    ]);
    const [splitMode, setSplitMode] = useState<'full' | 'split'>('full');
    const [splitCount, setSplitCount] = useState(2);

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
            <div className="flex min-h-screen items-center justify-center p-6 bg-[#F7F5F2] font-inter tracking-[-0.04em]">
                <div className="max-w-md rounded-[2.5rem] bg-white border border-gray-100 p-12 text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-6" />
                    <h1 className="text-3xl font-bold tracking-tight text-[#1A1C1E]">
                        Wrong Device Role.
                    </h1>
                    <p className="mt-4 text-gray-500 font-medium leading-relaxed">
                        This tablet is paired for a different workspace. Re-provision it as a waiter
                        device to access tableside service tools.
                    </p>
                </div>
            </div>
        );
    }

    if (managedDevice.isIdentityRevoked || !managedDevice.hasOutageAccess) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6 bg-[#F7F5F2] font-inter tracking-[-0.04em]">
                <div className="max-w-md rounded-[2.5rem] bg-white border border-gray-100 p-12 text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-6" />
                    <h1 className="text-3xl font-bold tracking-tight text-[#1A1C1E]">
                        Device Paused.
                    </h1>
                    <p className="mt-4 text-gray-500 font-medium leading-relaxed">
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
        <div className="flex h-screen overflow-hidden bg-[#F7F5F2] font-inter tracking-[-0.04em] text-[#1A1C1E] antialiased">
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
                                    className="h-10 w-10 rounded-xl object-cover border border-gray-100"
                                />
                            ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F5F2] text-xs font-bold text-[#1A1C1E]">
                                    {restaurant?.name?.charAt(0) || 'R'}
                                </div>
                            )}
                            <div>
                                <h1 className="text-lg font-bold leading-none mb-1">
                                    {isLoadingRestaurant ? 'Syncing...' : restaurant?.name || "Lole Enterprise"}
                                </h1>
                                <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                                    Terminal / {managedDevice.session?.name || 'Local'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex h-12 items-center gap-3 rounded-xl bg-emerald-50 px-5 text-emerald-600 border border-emerald-100/50">
                            <Banknote className="h-4 w-4" />
                            <span className="text-sm font-bold">0.00 Br. Tips</span>
                        </div>

                        <div className="flex h-12 items-center gap-3 rounded-xl bg-[#F7F5F2] px-5 text-gray-500 border border-gray-100">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm font-bold tabular-nums">{format(currentTime, 'p')}</span>
                        </div>

                        <div className="h-8 w-px bg-gray-100 mx-2" />

                        <div className="relative" ref={headerDropdownRef}>
                            <button
                                onClick={() => setIsHeaderDropdownOpen(!isHeaderDropdownOpen)}
                                className="flex h-12 cursor-pointer items-center gap-4 rounded-xl border border-gray-100 bg-white px-4 text-left transition-all hover:bg-gray-50"
                            >
                                <div className="w-8 h-8 rounded-lg bg-[#1A1C1E] text-[#DDF853] flex items-center justify-center">
                                    <User className="h-4 w-4" />
                                </div>
                                <div className="hidden sm:block">
                                    <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase leading-none mb-1">Staff</p>
                                    <p className="text-sm font-bold text-[#1A1C1E] leading-none">
                                        {staffSession?.name || 'Waitstaff'}
                                    </p>
                                </div>
                                <ChevronDown
                                    className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isHeaderDropdownOpen ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {isHeaderDropdownOpen && (
                                <div className="absolute top-[calc(100%+12px)] right-0 z-[100] w-64 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95">
                                    <div className="p-4 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Theme</span>
                                            <div className="flex items-center gap-1 bg-[#F7F5F2] p-1 rounded-lg">
                                                <button className="p-1.5 rounded-md bg-white text-[#1A1C1E] border border-gray-100">
                                                    <Sun className="h-3.5 w-3.5" />
                                                </button>
                                                <button className="p-1.5 rounded-md text-gray-400">
                                                    <Moon className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                sessionStorage.removeItem('gebata_waiter_context');
                                                setIsHeaderDropdownOpen(false);
                                                router.replace(`/waiter/pin?restaurantId=${managedDevice.session?.restaurant_id || ''}`);
                                            }}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-red-50 text-red-600 text-sm font-bold transition-colors hover:bg-red-100"
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
                    <div className="relative flex flex-1 flex-col gap-10 overflow-y-auto p-10 no-scrollbar">
                        {/* Filters & Search */}
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-1.5 h-8 bg-[#DDF853] rounded-full" />
                                    <h2 className="text-3xl font-bold text-[#1A1C1E]">Menu.</h2>
                                </div>
                                
                                <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl p-1.5 overflow-x-auto no-scrollbar max-w-[60%]">
                                    <button
                                        onClick={() => setSelectedCategoryId('all')}
                                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
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
                                            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
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
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#1A1C1E] transition-colors" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Search menu items..."
                                        className="w-full h-16 bg-white border border-gray-100 rounded-2xl pl-14 pr-6 text-lg font-medium focus:outline-none focus:border-[#DDF853] transition-all"
                                    />
                                </div>
                                <button 
                                    onClick={() => { setSearchTerm(''); setSelectedCategoryId('all'); }}
                                    className="h-16 px-8 bg-white border border-gray-100 rounded-2xl flex items-center gap-3 text-sm font-bold hover:bg-gray-50 transition-colors"
                                >
                                    <RotateCcw className="w-4 h-4 text-gray-400" />
                                    Reset
                                </button>
                            </div>
                        </div>

                        {/* Item Grid */}
                        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 pb-10">
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
                                                quantity > 0 ? 'border-[#DDF853] bg-white' : 'border-gray-100 bg-white hover:border-gray-200'
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
                                                <h3 className="line-clamp-2 text-base font-bold text-[#1A1C1E] mb-4">
                                                    {item.name}
                                                </h3>
                                                <div className="mt-auto flex items-center justify-between">
                                                    <span className="text-xl font-black text-[#1A1C1E]">
                                                        {formatCurrencyCompact(item.price / 100)}
                                                    </span>
                                                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                                                        quantity > 0 ? 'bg-[#1A1C1E] text-[#DDF853]' : 'bg-[#F7F5F2] text-gray-400 group-hover:bg-[#DDF853] group-hover:text-[#1A1C1E]'
                                                    }`}>
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
                            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#F7F5F2]/80 backdrop-blur-md animate-in fade-in duration-300">
                                <div className="w-full max-w-2xl bg-white border border-gray-100 rounded-[2.5rem] p-12 space-y-10" onClick={e => e.stopPropagation()}>
                                    <div className="flex flex-col items-center text-center">
                                        <div className="w-16 h-16 bg-[#F7F5F2] rounded-2xl flex items-center justify-center text-[#1A1C1E] mb-6">
                                            <Banknote className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-3xl font-bold text-[#1A1C1E]">Settlement.</h3>
                                        <p className="text-gray-500 font-medium mt-2">Select how you want to process this order.</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <button
                                            onClick={() => setSplitMode('full')}
                                            className={`h-32 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                                                splitMode === 'full' ? 'border-[#1A1C1E] bg-[#1A1C1E] text-white' : 'border-gray-50 bg-[#F7F5F2] text-gray-400 hover:border-gray-200'
                                            }`}
                                        >
                                            <span className="text-xl font-bold">Pay in Full</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Standard Checkout</span>
                                        </button>
                                        <button
                                            onClick={() => setSplitMode('split')}
                                            className={`h-32 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                                                splitMode === 'split' ? 'border-[#1A1C1E] bg-[#1A1C1E] text-white' : 'border-gray-50 bg-[#F7F5F2] text-gray-400 hover:border-gray-200'
                                            }`}
                                        >
                                            <span className="text-xl font-bold">Split Bill</span>
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Divide by Guest</span>
                                        </button>
                                    </div>

                                    <div className="pt-8 border-t border-gray-100 flex items-center justify-between">
                                        <button 
                                            onClick={() => setShowSplitPayment(false)}
                                            className="text-sm font-bold text-gray-400 hover:text-[#1A1C1E]"
                                        >
                                            Cancel Process
                                        </button>
                                        <button 
                                            onClick={() => setPaymentStatus('PAID')}
                                            className="h-16 px-10 bg-[#DDF853] text-[#1A1C1E] rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-[#DDF853]/10 hover:scale-105 active:scale-95 transition-all"
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
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="p-10 border-b border-gray-100">
                                <div className="flex items-center justify-between mb-10">
                                    <div>
                                        <p className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase mb-1">POS Terminal</p>
                                        <h2 className="text-4xl font-bold text-[#1A1C1E]">
                                            Order Details.
                                        </h2>
                                    </div>
                                    <div className="h-12 px-5 bg-[#F7F5F2] rounded-xl flex items-center gap-3 border border-gray-100">
                                        <div className="w-2 h-2 rounded-full bg-[#DDF853] animate-pulse" />
                                        <span className="text-sm font-bold text-[#1A1C1E]">Live Sync</span>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-1 bg-[#F7F5F2] p-5 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-3">Service Type</p>
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-[#1A1C1E] text-lg">{orderType}</span>
                                            <ChevronDown className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-[#F7F5F2] p-5 rounded-2xl border border-gray-100">
                                        <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-3">Table Location</p>
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-[#1A1C1E] text-lg">
                                                {tables.find(t => t.id === selectedTableId)?.table_number || 'None'}
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Order Items */}
                            <div className="flex-1 overflow-y-auto px-10 py-10 no-scrollbar">
                                {Object.entries(groupedCartItems).map(([course, items]) => (
                                    <div key={course} className="mb-12 last:mb-0">
                                        <h3 className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase mb-8 border-b border-gray-50 pb-4">{course}</h3>
                                        <div className="space-y-8">
                                            {items.map(item => (
                                                <div key={item.uniqueId} className="group flex items-start gap-6">
                                                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#F7F5F2] border border-gray-100">
                                                        {item.image ? (
                                                            <Image src={item.image} alt={item.title} width={80} height={80} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <div className="flex h-full w-full items-center justify-center text-gray-300">
                                                                <UtensilsCrossed className="h-8 w-8" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="truncate text-lg font-bold text-[#1A1C1E]">{item.title}</h4>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-sm font-black text-[#DDF853]">{formatCurrencyCompact(item.price)}</span>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">per unit</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-3">
                                                        <div className="flex items-center gap-3 bg-[#F7F5F2] p-1.5 rounded-xl border border-gray-100">
                                                            <button 
                                                                onClick={() => cart.removeFromCart(item.uniqueId)}
                                                                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                            <span className="w-10 text-center font-black text-[#1A1C1E] text-lg">
                                                                {item.quantity}
                                                            </span>
                                                            <button 
                                                                onClick={() => cart.addToCart({ ...item, quantity: 1 })}
                                                                className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#1A1C1E] hover:bg-white transition-all"
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
                                    <div className="flex h-full flex-col items-center justify-center text-center opacity-30 py-20 grayscale">
                                        <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-[#F7F5F2]">
                                            <ShoppingCart className="h-10 w-10 text-gray-400" />
                                        </div>
                                        <p className="text-lg font-bold text-gray-400">Order is empty.</p>
                                    </div>
                                )}
                            </div>

                            {/* Summary Area */}
                            <div className="p-10 bg-[#F7F5F2]/50 border-t border-gray-100">
                                <div className="space-y-5 mb-10">
                                    <div className="flex items-center justify-between text-gray-400 font-medium">
                                        <span>Subtotal</span>
                                        <span className="font-bold text-[#1A1C1E] tabular-nums">{formatCurrencyCompact(cart.total)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-gray-400 font-medium">
                                        <span>Tax (15.0%)</span>
                                        <span className="font-bold text-[#1A1C1E] tabular-nums">{formatCurrencyCompact(cart.total * 0.15)}</span>
                                    </div>
                                    <div className="pt-6 flex items-center justify-between border-t border-gray-200">
                                        <span className="text-2xl font-bold text-[#1A1C1E]">Total Amount.</span>
                                        <span className="text-4xl font-black text-[#1A1C1E] tabular-nums tracking-tighter">{formatCurrencyCompact(totalWithTax)}</span>
                                    </div>
                                </div>

                                <button
                                    disabled={cart.items.length === 0}
                                    onClick={() => setShowSplitPayment(true)}
                                    className="w-full h-24 bg-[#1A1C1E] text-[#DDF853] rounded-[2.5rem] flex items-center justify-center gap-4 text-xl font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:grayscale shadow-2xl shadow-black/10"
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
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white animate-in fade-in duration-1000">
                    <div className="flex flex-col items-center gap-16 text-center max-w-2xl px-10">
                        <div className="relative">
                            <div className="w-56 h-56 rounded-[3.5rem] bg-[#F7F5F2] flex items-center justify-center">
                                <div className="w-36 h-36 rounded-full bg-[#DDF853] flex items-center justify-center shadow-xl shadow-[#DDF853]/20">
                                    <CheckCircle2 className="w-20 h-20 text-[#1A1C1E]" strokeWidth={2.5} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h2 className="text-6xl font-black tracking-tighter text-[#1A1C1E]">Success.</h2>
                            <p className="text-xl font-medium text-gray-500 leading-relaxed max-w-md mx-auto">The transaction was authorized and the order has been synchronized with the main terminal.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6 w-full">
                            <button className="h-24 bg-[#1A1C1E] text-white rounded-[2rem] font-black uppercase tracking-widest text-sm flex items-center justify-center gap-4 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                <Printer className="w-5 h-5 text-[#DDF853]" />
                                Print Receipt
                            </button>
                            <button 
                                onClick={() => { setPaymentStatus('PENDING'); cart.clearCart(); }}
                                className="h-24 bg-[#F7F5F2] text-[#1A1C1E] rounded-[2rem] font-black uppercase tracking-widest text-sm hover:bg-gray-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
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
