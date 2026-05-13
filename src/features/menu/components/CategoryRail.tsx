'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useHaptic';
import { ShoppingBag, Zap, Gift, Ticket, Crown, Flame } from 'lucide-react';

const CATEGORIES = [
    {
        id: 'greatbuy',
        name: 'GreatBuy',
        icon: <ShoppingBag size={24} className="text-white" />,
        gradient: 'bg-gradient-to-br from-[#FF8BA7] via-[#FF4D6D] to-[#C91D26]',
    },
    {
        id: 'flash',
        name: 'Flash',
        icon: <Zap size={24} className="fill-white text-white" />,
        gradient: 'bg-gradient-to-br from-[#B588FF] via-[#9D5EFF] to-[#7A2BFF]',
    },
    {
        id: 'gift',
        name: 'Gift',
        icon: <Gift size={24} className="text-white" />,
        gradient: 'bg-gradient-to-br from-[#80E8FF] via-[#4DDAFF] to-[#00A3FF]',
    },
    {
        id: 'coupon',
        name: 'Coupon',
        icon: <Ticket size={24} className="text-white" />,
        gradient: 'bg-gradient-to-br from-[#D1B3FF] via-[#B885FF] to-[#9D5EFF]',
    },
    {
        id: 'viparea',
        name: 'VIPArea',
        icon: <Crown size={24} className="fill-white text-white" />,
        gradient: 'bg-gradient-to-br from-[#FFD1A3] via-[#FFA64D] to-[#FF8000]',
    },
    {
        id: 'new',
        name: 'New',
        icon: <Flame size={24} className="text-white" />,
        gradient: 'bg-gradient-to-br from-[#FFD93D] via-[#FFC107] to-[#FF8F00]',
    },
];

interface CategoryRailProps {
    activeCategoryId?: string;
    onCategoryChange?: (id: string) => void;
}

export function CategoryRail({
    activeCategoryId = 'greatbuy',
    onCategoryChange,
}: CategoryRailProps) {
    const { trigger } = useHaptic();

    return (
        <div className="no-scrollbar flex w-full gap-5 overflow-x-auto px-6 py-6">
            {CATEGORIES.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => {
                        trigger('soft');
                        onCategoryChange?.(cat.id);
                    }}
                    className="flex flex-col items-center gap-2.5 transition-transform active:scale-90"
                >
                    <div
                        className={cn(
                            'flex h-16 w-16 items-center justify-center rounded-[24px] shadow-[0_8px_20px_rgba(0,0,0,0.08)]',
                            cat.gradient
                        )}
                    >
                        {cat.icon}
                    </div>
                    <span
                        className={cn(
                            'text-[10px] font-bold tracking-tight transition-colors',
                            activeCategoryId === cat.id ? 'text-black' : 'text-black/30'
                        )}
                    >
                        {cat.name}
                    </span>
                </button>
            ))}
        </div>
    );
}
