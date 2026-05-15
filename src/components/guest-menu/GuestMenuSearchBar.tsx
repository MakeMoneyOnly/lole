'use client';

import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { GUEST_MENU_GRADIENT } from './shared/GuestMenuGradient';

export const GuestMenuSearchBar: React.FC<{
    onSearchTap?: () => void;
    onFilterTap?: () => void;
}> = ({ onSearchTap, onFilterTap }) => {
    return (
        <div className="flex w-full items-center gap-3 px-5 py-[7px]">
            <div
                onClick={onSearchTap}
                className="flex h-[52px] flex-1 cursor-pointer items-center gap-3 rounded-[18px] bg-[#FFFFFF] border border-brand-neutral-soft/10 px-4 transition-all hover:bg-gray-50"
            >
                <Search className="h-5 w-5 text-gray-400" />
                <span className="text-[14px] font-light text-gray-400">
                    What's on your list?
                </span>
            </div>
            <button
                onClick={onFilterTap}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] transition-transform active:scale-95"
                style={{ background: GUEST_MENU_GRADIENT }}
            >
                <SlidersHorizontal className="h-5 w-5 text-black" />
            </button>
        </div>
    );
};
