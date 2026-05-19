'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CategoryCardProps {
    name: string;
    icon: string;
    active?: boolean;
    onTap?: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ name, icon, active, onTap }) => {
    return (
        <button
            onClick={onTap}
            className={cn(
                'flex min-w-[90px] flex-col items-center gap-2 rounded-[24px] p-3 transition-all active:scale-95',
                active
                    ? 'bg-[#1A1C1E] text-white shadow-lg shadow-black/10'
                    : 'border border-gray-100 bg-white text-[#1A1C1E]'
            )}
        >
            <div
                className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-[18px] text-2xl',
                    active ? 'bg-white/10' : 'bg-gray-50'
                )}
            >
                {icon}
            </div>
            <span className="text-[13px] font-bold tracking-[-0.04em]">{name}</span>
        </button>
    );
};
