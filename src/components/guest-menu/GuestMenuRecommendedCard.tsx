'use client';

import React from 'react';
import Image from 'next/image';
import { ArrowUpRight } from 'lucide-react';
import { MenuItem } from '@/app/(guest)/[slug]/menu-client';
import { formatCurrency, cleanItemTitle } from '@/lib/utils/monetary';

interface GuestMenuRecommendedCardProps {
    item?: MenuItem;
    onSelect?: (item: MenuItem) => void;
    onAddToCart?: (item: MenuItem) => void;
}

export const GuestMenuRecommendedCard: React.FC<GuestMenuRecommendedCardProps> = ({
    item,
    onSelect,
    onAddToCart
}) => {
    if (!item) return null;

    // Use category name proper-cased or fallback to Chef's choice
    const rawCategory = item.categories?.name || 'Lunch Special';
    const categoryTag = rawCategory
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    
    // Format the price in ETB (hiding decimals according to standard requirements)
    const formattedPrice = formatCurrency(item.price);
    const cleanedTitle = cleanItemTitle(item.title);

    return (
        <div 
            onClick={() => onSelect?.(item)}
            className="group relative flex w-full h-full flex-col justify-between overflow-hidden rounded-[32px] bg-neutral-900 shadow-2xl cursor-pointer transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] active:scale-[0.99]"
        >
            {/* Background Full-bleed Food Image (based on Image 2 landing page style) */}
            <div className="absolute inset-0 h-full w-full">
                <Image
                    src={
                        item.imageUrl ||
                        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop'
                    }
                    alt={cleanedTitle}
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    priority
                    unoptimized={true}
                />
            </div>

            {/* Top Gradient Overlay (lighter to let photography shine) */}
            <div className="absolute top-0 left-0 right-0 h-[40%] bg-gradient-to-b from-black/40 to-transparent opacity-90 transition-opacity duration-300" />

            {/* Top Row: Category Tag & Button */}
            <div className="relative z-10 flex items-start justify-between p-5">
                <span className="rounded-full bg-black/40 backdrop-blur-md px-3 py-1.5 text-[12px] font-bold text-[#DDF853] tracking-[-0.04em]">
                    {categoryTag}
                </span>

                {/* Top-Right Action Button */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onAddToCart) {
                            onAddToCart(item);
                        } else {
                            onSelect?.(item);
                        }
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#DDF853] text-[#1A1C1E] transition-all duration-300 hover:scale-110 active:scale-95 shadow-md"
                >
                    <ArrowUpRight className="h-5 w-5 stroke-[2.5]" />
                </button>
            </div>

            {/* Bottom Row: Text Content with Faded Blur Overlay (Image 2 landing page signature effect) */}
            <div className="absolute right-0 bottom-0 left-0 transition-all duration-300">
                {/* 1. Dark Gradient backing - neutralizes raw color bleed from underlying photo to prevent muddy glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-95" />
                
                {/* 2. Premium frosted glass filter overlay with mask fading */}
                <div 
                    className="absolute inset-0 backdrop-blur-md bg-black/10" 
                    style={{
                        WebkitMaskImage: 'linear-gradient(to top, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0) 100%)',
                        maskImage: 'linear-gradient(to top, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0) 100%)'
                    }}
                />
                
                {/* Content Container */}
                <div className="relative z-10 flex flex-col p-5 pt-12">
                    <div className="flex items-end justify-between gap-2">
                        <div className="flex flex-col">
                            <h3 className="text-[20px] font-bold tracking-[-0.04em] text-white leading-tight line-clamp-1">
                                {cleanedTitle}
                            </h3>
                            <p className="text-[13px] font-medium text-white/80 tracking-[-0.04em] mt-0.5 line-clamp-1">
                                {item.description || `${item.preparationTime || 15} mins • Freshly Cooked`}
                            </p>
                        </div>
                        <span className="text-[20px] font-bold text-[#DDF853] tracking-[-0.04em] leading-tight shrink-0">
                            {formattedPrice}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
