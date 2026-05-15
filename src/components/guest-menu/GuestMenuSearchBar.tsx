'use client';

import React from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';

export const GuestMenuSearchBar: React.FC<{
    onSearchTap?: () => void;
    onFilterTap?: () => void;
}> = ({ onSearchTap, onFilterTap }) => {
    return (
        <div className="flex w-full items-center gap-3 px-5 py-3">
            <div
                onClick={onSearchTap}
                className="flex h-[56px] flex-1 cursor-pointer items-center gap-3 rounded-[24px] bg-[#F6F6F6] px-5 transition-all hover:bg-gray-100"
            >
                <Search className="h-[18px] w-[18px] text-gray-500" strokeWidth={2} />
                <span className="text-[15px] font-medium text-gray-400">Search Food...</span>
            </div>
            <button
                onClick={onFilterTap}
                className="flex h-[56px] w-[56px] items-center justify-center rounded-[24px] bg-[#FFFFFF] shadow-sm shadow-black/5 transition-transform active:scale-95"
            >
                <SlidersHorizontal className="h-5 w-5 text-[#1A1A1A]" strokeWidth={1.5} />
            </button>
        </div>
    );
};
