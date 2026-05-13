'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useHaptic';

const FILTERS = ['Trending', 'New', 'Popular', 'Top Selling'];

export function MartrezaCategoryChips() {
    const { trigger } = useHaptic();
    const [selectedIndex, setSelectedIndex] = React.useState(0);

    return (
        <div className="no-scrollbar flex w-full gap-4 overflow-x-auto px-6 pt-1 pb-3">
            {FILTERS.map((filter, index) => (
                <button
                    key={filter}
                    onClick={() => {
                        trigger('soft');
                        setSelectedIndex(index);
                    }}
                    className={cn(
                        'px-1 py-2 text-base whitespace-nowrap drop-shadow-md transition-all active:scale-95',
                        selectedIndex === index
                            ? 'border-b-2 border-white font-bold text-white'
                            : 'font-medium text-white/80'
                    )}
                >
                    {filter}
                </button>
            ))}
        </div>
    );
}
