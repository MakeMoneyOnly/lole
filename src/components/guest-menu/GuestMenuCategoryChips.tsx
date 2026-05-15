'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface Category {
    id: string;
    name: string;
}

interface GuestMenuCategoryChipsProps {
    categories: Category[];
    activeCategoryId: string;
    onCategoryChange: (id: string) => void;
}

export const GuestMenuCategoryChips: React.FC<GuestMenuCategoryChipsProps> = ({
    categories,
    activeCategoryId,
    onCategoryChange,
}) => {
    // Add "Popular" category if not present
    const allCategories = [{ id: 'all', name: 'Popular' }, ...categories];

    return (
        <div className="no-scrollbar flex h-16 w-full items-center overflow-x-auto px-5">
            <div className="flex gap-3">
                {allCategories.map(category => {
                    const isActive = activeCategoryId === category.id;
                    return (
                        <button
                            key={category.id}
                            onClick={() => onCategoryChange(category.id)}
                            className={cn(
                                'flex h-[46px] items-center justify-center rounded-[20px] px-6 text-[14px] whitespace-nowrap shadow-sm shadow-black/5 transition-all active:scale-95',
                                !isActive && 'bg-[#FFFFFF] font-medium text-[#1A1A1A]',
                                isActive && 'bg-[#1A1A1A] font-semibold text-[#FFFFFF]'
                            )}
                        >
                            {category.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
