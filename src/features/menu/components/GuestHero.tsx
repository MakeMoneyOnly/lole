'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { Bell, ShoppingCart, Search, Scan } from 'lucide-react';
import { useHaptic } from '@/hooks/useHaptic';

interface GuestHeroProps {
    userName?: string;
    fullName?: string;
    cartCount?: number;
    onCartClick?: () => void;
    activeTab?: 'food' | 'drinks';
    onTabChange?: (tab: 'food' | 'drinks') => void;
}

export function GuestHero({
    userName = 'leo',
    fullName = 'Blair Chen',
    cartCount = 0,
    onCartClick,
}: GuestHeroProps) {
    const { trigger } = useHaptic();

    return (
        <div className="relative w-full overflow-hidden bg-gradient-to-b from-[#E0F2FF] via-[#F8FDFF] to-white pt-12 pb-6">
            {/* Header Row */}
            <div className="mx-auto max-w-lg px-6">
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <span className="text-sm font-medium tracking-tight text-black/40">
                            Hi {userName},
                        </span>
                        <h1 className="text-2xl font-black tracking-tighter text-black">
                            {fullName}
                        </h1>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => trigger('soft')}
                            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur-xl transition-transform active:scale-90"
                        >
                            <Bell size={20} strokeWidth={2} className="text-black" />
                        </button>
                        <button
                            onClick={() => {
                                trigger('soft');
                                onCartClick?.();
                            }}
                            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur-xl transition-transform active:scale-90"
                        >
                            <ShoppingCart size={20} strokeWidth={2} className="text-black" />
                            {cartCount > 0 && (
                                <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                                    {cartCount}
                                </div>
                            )}
                        </button>
                    </div>
                </div>

                {/* Modern Search Bar */}
                <div className="group relative">
                    <div className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">
                        <Search size={18} className="text-black/20" />
                    </div>
                    <input
                        type="text"
                        placeholder="What are you looking for?"
                        className="h-14 w-full rounded-2xl bg-white px-12 text-sm font-medium text-black shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all outline-none placeholder:text-black/20 focus:ring-2 focus:ring-blue-100"
                    />
                    <button
                        onClick={() => trigger('rigid')}
                        className="absolute top-1/2 right-4 -translate-y-1/2 text-black/60 transition-colors hover:text-black"
                    >
                        <Scan size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
