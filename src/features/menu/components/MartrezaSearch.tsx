'use client';
import React from 'react';
import { Search, SlidersHorizontal, Bell } from 'lucide-react';
import { useHaptic } from '@/hooks/useHaptic';

export function MartrezaSearch() {
    const { trigger } = useHaptic();

    return (
        <div className="flex items-center gap-2 px-4 py-1">
            {/* Search pill — sliders icon inside on the right */}
            <div className="relative flex flex-1 items-center rounded-[18px] bg-white/95 shadow-sm backdrop-blur-md">
                <Search size={17} className="absolute left-4 shrink-0 text-[#9E9E9E]" />
                <span className="flex-1 py-3 pr-12 pl-10 text-sm font-light tracking-tight text-[#9E9E9E]">
                    What&apos;s on your list?
                </span>
                {/* Sliders filter button — inside bar, right side */}
                <button
                    onClick={() => trigger('rigid')}
                    className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-[12px] bg-[#ddf853] transition-transform active:scale-95"
                >
                    <SlidersHorizontal size={15} className="text-black" />
                </button>
            </div>

            {/* Notification bell — right of search bar */}
            <button
                onClick={() => trigger('soft')}
                className="flex h-[44px] w-[44px] shrink-0 items-center justify-center transition-transform active:scale-95"
            >
                <Bell size={22} className="text-white drop-shadow-md" />
            </button>
        </div>
    );
}
