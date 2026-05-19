'use client';

import React from 'react';
import { Star, Plus } from 'lucide-react';
import { MenuItem } from '@/app/(guest)/[slug]/menu-client';
import { GUEST_MENU_GRADIENT } from './shared/GuestMenuGradient';
import { formatCurrency } from '@/lib/utils';
import { cleanItemTitle } from '@/lib/utils/monetary';
import Image from 'next/image';

const HeartLineIcon = ({ className }: { className?: string }): React.ReactElement => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path fillRule="evenodd" clipRule="evenodd" d="M5.62436 4.4241C3.96537 5.18243 2.75 6.98614 2.75 9.13701C2.75 11.3344 3.64922 13.0281 4.93829 14.4797C6.00072 15.676 7.28684 16.6675 8.54113 17.6345C8.83904 17.8642 9.13515 18.0925 9.42605 18.3218C9.95208 18.7365 10.4213 19.1004 10.8736 19.3647C11.3261 19.6292 11.6904 19.7499 12 19.7499C12.3096 19.7499 12.6739 19.6292 13.1264 19.3647C13.5787 19.1004 14.0479 18.7365 14.574 18.3218C14.8649 18.0925 15.161 17.8642 15.4589 17.6345C16.7132 16.6675 17.9993 15.676 19.0617 14.4797C20.3508 13.0281 21.25 11.3344 21.25 9.13701C21.25 6.98614 20.0346 5.18243 18.3756 4.4241C16.9023 3.75065 14.9662 3.85585 13.0725 5.51217L14.5302 6.9694C14.8232 7.26224 14.8233 7.73711 14.5304 8.03006C14.2376 8.323 13.7627 8.32309 13.4698 8.03025L11.4698 6.03097L11.4596 6.02065C9.40166 3.88249 7.23607 3.68739 5.62436 4.4241ZM12 4.45873C9.68795 2.39015 7.09896 2.10078 5.00076 3.05987C2.78471 4.07283 1.25 6.42494 1.25 9.13701C1.25 11.8025 2.3605 13.836 3.81672 15.4757C4.98287 16.7888 6.41022 17.8879 7.67083 18.8585C7.95659 19.0785 8.23378 19.292 8.49742 19.4998C9.00965 19.9036 9.55954 20.3342 10.1168 20.6598C10.6739 20.9853 11.3096 21.2499 12 21.2499C12.6904 21.2499 13.3261 20.9853 13.8832 20.6598C14.4405 20.3342 14.9903 19.9036 15.5026 19.4998C15.7662 19.292 16.0434 19.0785 16.3292 18.8585C17.5898 17.8879 19.0171 16.7888 20.1833 15.4757C21.6395 13.836 22.75 11.8025 22.75 9.13701C22.75 6.42494 21.2153 4.07283 18.9992 3.05987C16.901 2.10078 14.3121 2.39015 12 4.45873Z" fill="currentColor"/>
    </svg>
);

const HeartFillIcon = ({ className }: { className?: string }): React.ReactElement => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M8.10627 18.2468C5.29819 16.0833 2 13.5422 2 9.1371C2 4.27416 7.50016 0.825464 12 5.50063L14 7.49928C14.2929 7.79212 14.7678 7.79203 15.0607 7.49908C15.3535 7.20614 15.3534 6.73127 15.0605 6.43843L13.1285 4.50712C17.3685 1.40309 22 4.67465 22 9.1371C22 13.5422 18.7018 16.0833 15.8937 18.2468C15.6019 18.4717 15.3153 18.6925 15.0383 18.9109C14 19.7294 13 20.5 12 20.5C11 20.5 10 19.7294 8.96173 18.9109C8.68471 18.6925 8.39814 18.4717 8.10627 18.2468Z" fill="currentColor"/>
    </svg>
);

const getStableSoldCount = (item: MenuItem): number => {
    if (item.popularity) return item.popularity;
    const seed = item.id || item.title || 'default';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 46) + 5;
};

const MarqueeTitle: React.FC<{ title: string }> = ({ title }) => {
    const isLong = title.length > 16;
    const cleanId = title.replace(/[^a-zA-Z0-9]/g, '');
    
    if (!isLong) {
        return (
            <h3 className="text-[16px] font-bold text-[#1A1C1E] tracking-[-0.04em] whitespace-nowrap overflow-hidden">
                {title}
            </h3>
        );
    }
    
    return (
        <div className="w-full overflow-hidden whitespace-nowrap relative">
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes marquee-${cleanId} {
                    0% { transform: translateX(0%); }
                    10% { transform: translateX(0%); }
                    55% { transform: translateX(calc(-100% + 140px)); }
                    65% { transform: translateX(calc(-100% + 140px)); }
                    95% { transform: translateX(0%); }
                    100% { transform: translateX(0%); }
                }
                .animate-marquee-${cleanId} {
                    display: inline-block;
                    animation: marquee-${cleanId} 8s ease-in-out infinite;
                }
            `}} />
            <div className={`animate-marquee-${cleanId} text-[16px] font-bold text-[#1A1C1E] tracking-[-0.04em] pr-4`}>
                {title}
            </div>
        </div>
    );
};

export const GuestMenuProductCard: React.FC<{
    item: MenuItem;
    onAddToCart?: (item: MenuItem) => void;
    onSelect?: (item: MenuItem) => void;
}> = ({ item, onAddToCart, onSelect }) => {
    const [isLiked, setIsLiked] = React.useState(false);
    const cleanedTitle = cleanItemTitle(item.title);

    return (
        <div className="flex w-full flex-col gap-2.5">
            <div className="relative aspect-square w-full">
                <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-brand-neutral-soft/10 bg-[#F6F6F6]">
                    {item.imageUrl ? (
                        <Image
                            src={item.imageUrl}
                            alt={cleanedTitle}
                            fill
                            className="object-cover"
                            onClick={() => onSelect?.(item)}
                            unoptimized={true}
                        />
                    ) : (
                        <div 
                            className="flex h-full w-full items-center justify-center bg-[#F6F6F6] cursor-pointer"
                            onClick={() => onSelect?.(item)}
                        >
                            <span className="text-[32px] font-bold text-black/10 select-none">
                                {cleanedTitle ? cleanedTitle.charAt(0).toUpperCase() : 'L'}
                            </span>
                        </div>
                    )}
                </div>
                
                {/* Heart Button */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsLiked(!isLiked);
                    }}
                    className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-black/5 transition-transform active:scale-90 shadow-sm"
                >
                    {isLiked ? (
                        <HeartFillIcon className="h-[18px] w-[18px] text-[#EF4444]" />
                    ) : (
                        <HeartLineIcon className="h-[18px] w-[18px] text-[#1A1C1E]" />
                    )}
                </button>
 
                {/* Shop/Cart Button (Plus Icon, Squircle Shaped) */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart?.(item);
                    }}
                    className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-[12px] transition-transform active:scale-95 shadow-md border border-black/5"
                    style={{ background: GUEST_MENU_GRADIENT }}
                >
                    <Plus className="h-5 w-5 text-black" strokeWidth={2.5} />
                </button>
            </div>

            <div className="flex flex-col gap-1 px-1 mt-0.5">
                <MarqueeTitle title={cleanedTitle} />
                
                <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-black/40 tracking-[-0.04em]">
                        {getStableSoldCount(item)} ordered today
                    </span>
                    <div className="flex items-center gap-0.5">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span className="text-[12px] font-bold text-black tracking-[-0.04em]">
                            {item.rating?.toFixed(1) || '4.8'}
                        </span>
                    </div>
                </div>

                <span className="text-[15px] font-bold text-[#1A1C1E] tracking-[-0.04em] mt-0.5">
                    {formatCurrency(item.price / 100)}
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
