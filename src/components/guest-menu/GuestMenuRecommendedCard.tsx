'use client';

import React from 'react';
import Image from 'next/image';
import { Heart, Plus } from 'lucide-react';
import { MenuItem } from '@/app/(guest)/[slug]/menu-client';

export const GuestMenuRecommendedCard: React.FC<{
    item?: MenuItem;
}> = ({ item }) => {
    // We'll use a placeholder structure for the design clone.
    return (
        <div className="relative flex aspect-[4/3] w-full flex-col justify-between overflow-hidden rounded-[32px] bg-[#C5E983] p-5">
            {/* Top Badges */}
            <div className="z-10 flex items-start justify-between">
                <div className="rounded-full border border-white/20 bg-white/40 px-4 py-2 backdrop-blur-md">
                    <span className="text-[13px] font-medium text-[#1A1A1A]">20% Off</span>
                </div>
                <button className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/40 backdrop-blur-md transition-transform active:scale-95">
                    <Heart className="h-[18px] w-[18px] text-[#DDF853]" strokeWidth={1.5} />
                </button>
            </div>

            {/* Burger Image (absolute centered) */}
            <div className="absolute inset-0 -mt-4 flex scale-110 items-center justify-center">
                <Image
                    src={
                        item?.imageUrl ||
                        'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop'
                    }
                    alt="Burger"
                    width={400}
                    height={400}
                    className="object-contain"
                />
            </div>

            {/* Bottom Glassy Details */}
            <div className="relative z-10 flex items-center justify-between rounded-[24px] border border-white/30 bg-white/40 p-2 pl-4 backdrop-blur-md">
                <div className="flex flex-col justify-center">
                    <h3 className="text-[15px] leading-tight font-semibold tracking-tight text-[#1A1A1A]">
                        {item?.title || 'Black Lavel Burger'}
                    </h3>
                    <span className="text-[13px] font-medium text-[#1A1A1A]/60">650 Kcal</span>
                </div>
                <button className="flex h-11 items-center gap-1.5 rounded-[18px] bg-white px-4 shadow-sm transition-transform active:scale-95">
                    <Plus className="h-4 w-4 text-[#1A1A1A]" strokeWidth={2} />
                    <span className="text-[14px] font-medium text-[#1A1A1A]">Add</span>
                </button>
            </div>
        </div>
    );
};
