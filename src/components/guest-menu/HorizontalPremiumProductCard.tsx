'use client';

import React from 'react';
import { Heart, User } from 'lucide-react';
import { MenuItem } from '@/app/(guest)/[slug]/menu-client';
import { GUEST_MENU_GRADIENT } from './shared/GuestMenuGradient';
import { formatCurrency } from '@/lib/utils';
import { cleanItemTitle } from '@/lib/utils/monetary';
import Image from 'next/image';

export const HorizontalPremiumProductCard: React.FC<{
    item: MenuItem;
    onAddToCart?: (item: MenuItem) => void;
    onSelect?: (item: MenuItem) => void;
}> = ({ item, onAddToCart, onSelect }) => {
    const cleanedTitle = cleanItemTitle(item.title);

    return (
        <div 
            onClick={() => onSelect?.(item)}
            className="mb-[15px] flex w-full flex-col gap-3 rounded-[24px] bg-[#FFFFFF] border border-brand-neutral-soft/10 p-4 transition-all active:scale-[0.98]"
        >
            <div className="flex gap-[15px]">
                <div className="relative h-[100px] w-[100px] shrink-0">
                    <Image
                        src={item.imageUrl || 'https://via.placeholder.com/100x100?text=No+Image'}
                        alt={cleanedTitle}
                        fill
                        className="rounded-[16px] object-cover"
                        unoptimized={true}
                    />
                </div>
                
                <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <h3 className="line-clamp-1 text-[17px] font-bold text-[#1A1C1E] tracking-[-0.04em]">
                            {cleanedTitle}
                        </h3>
                        <button className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFFFFF] border border-brand-neutral-soft/10">
                            <Heart className="h-[14px] w-[14px] text-black" />
                        </button>
                    </div>
                    
                    <span className="text-[13px] font-medium text-gray-400 tracking-[-0.04em]">
                        Size : M
                    </span>

                    <div className="mt-auto flex items-center justify-between">
                        <span className="text-[18px] font-bold text-[#1A1C1E] tracking-[-0.04em]">
                            {formatCurrency(item.price)}
                        </span>
                        <span className="text-[13px] font-medium text-gray-400 tracking-[-0.04em]">
                            X2
                        </span>
                    </div>
                </div>
            </div>

            <div className="h-[1px] w-full bg-black/5" />

            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <span className="text-[13px] font-medium text-gray-400 tracking-[-0.04em]">Estimate Total</span>
                    <span className="text-[20px] font-bold text-[#1A1C1E] tracking-[-0.04em]">
                        {formatCurrency(item.price)}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onAddToCart?.(item);
                        }}
                        className="rounded-[20px] px-4 py-2 text-[12px] font-bold text-black tracking-[-0.04em] transition-transform active:scale-95"
                        style={{ background: GUEST_MENU_GRADIENT }}
                    >
                        Shop
                    </button>
                    <div 
                        className="flex h-11 w-11 items-center justify-center rounded-full"
                        style={{ background: GUEST_MENU_GRADIENT }}
                    >
                        <User className="h-5 w-5 text-black" />
                    </div>
                </div>
            </div>
        </div>
    );
};
