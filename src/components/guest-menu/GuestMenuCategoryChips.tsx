'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { GUEST_MENU_GRADIENT } from './shared/GuestMenuGradient';

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
    // Add "All" category if not present
    const allCategories = [{ id: 'all', name: 'Trending' }, ...categories];

    return (
        <div className="no-scrollbar flex h-[46px] w-full overflow-x-auto px-5">
            <div className="flex gap-3">
                {allCategories.map((category) => {
                    const isActive = activeCategoryId === category.id;
                    return (
                        <button
                            key={category.id}
                            onClick={() => onCategoryChange(category.id)}
                            className={cn(
                                'flex h-[46px] items-center justify-center whitespace-nowrap rounded-[18px] px-6 text-[14px] transition-all active:scale-95',
                                !isActive && 'bg-white border border-brand-neutral-soft/10 font-light text-black/50',
                                isActive && 'font-medium text-black'
                            )}
                            style={isActive ? { background: GUEST_MENU_GRADIENT } : {}}
                        >
                            {category.name}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
