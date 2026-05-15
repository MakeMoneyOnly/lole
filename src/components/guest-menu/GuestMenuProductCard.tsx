'use client';

import React from 'react';
import { Star, Heart, ShoppingBag } from 'lucide-react';
import { MenuItem } from '@/app/(guest)/[slug]/menu-client';
import { GUEST_MENU_GRADIENT } from './shared/GuestMenuGradient';
import { formatCurrency } from '@/lib/utils';
import Image from 'next/image';

export const GuestMenuProductCard: React.FC<{
    item: MenuItem;
    onAddToCart?: (item: MenuItem) => void;
    onSelect?: (item: MenuItem) => void;
}> = ({ item, onAddToCart, onSelect }) => {
    return (
        <div className="flex w-full flex-col gap-3">
            <div className="relative aspect-square w-full">
                <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-brand-neutral-soft/10">
                    <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        className="object-cover"
                        onClick={() => onSelect?.(item)}
                    />
                </div>
                
                {/* Heart Button */}
                <button className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#FFFFFF] border border-brand-neutral-soft/10 transition-transform active:scale-90">
                    <Heart className="h-[18px] w-[18px] text-black" />
                </button>

                {/* Shop/Cart Button */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart?.(item);
                    }}
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-[20px] px-3 py-2 transition-transform active:scale-95"
                    style={{ background: GUEST_MENU_GRADIENT }}
                >
                    <ShoppingBag className="h-3.5 w-3.5 text-black" />
                    <span className="text-[12px] font-medium text-black">Shop</span>
                </button>
            </div>

            <div className="flex flex-col gap-1 px-1">
                <h3 className="line-clamp-1 text-[16px] font-semibold text-black tracking-tight">
                    {item.title}
                </h3>
                
                <div className="flex items-center justify-between">
                    <span className="text-[14px] font-light text-black/50">
                        {item.popularity || Math.floor(Math.random() * 50) + 5} sold
                    </span>
                    <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span className="text-[14px] font-medium text-black">
                            {item.rating?.toFixed(1) || '4.8'}
                        </span>
                    </div>
                </div>

                <span className="text-[16px] font-bold text-black mt-0.5">
                    {formatCurrency(item.price)}
                </span>
            </div>
        </div>
    );
};

export const GuestMenuProductGrid: React.FC<{
    items: MenuItem[];
    onAddToCart?: (item: MenuItem) => void;
    onSelect?: (item: MenuItem) => void;
}> = ({ items, onAddToCart, onSelect }) => {
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 px-5">
            {items.map((item) => (
                <GuestMenuProductCard 
                    key={item.id} 
                    item={item} 
                    onAddToCart={onAddToCart}
                    onSelect={onSelect}
                />
            ))}
        </div>
    );
};
