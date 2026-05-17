'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const SEARCH_ITEMS = [
    'Burgers',
    'Pizza',
    'Sushi',
    'Tacos',
    'Drinks',
    'Desserts',
    'Pasta',
    'Salads',
];

export const GuestMenuSearchBar: React.FC<{
    value?: string;
    onChange?: (val: string) => void;
    onFilterTap?: () => void;
}> = ({ value, onChange, onFilterTap }) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (value) return; // Stop animation if user is typing
        const interval = setInterval(() => {
            setIndex(prev => (prev + 1) % SEARCH_ITEMS.length);
        }, 2500);
        return () => clearInterval(interval);
    }, [value]);

    return (
        <div className="flex w-full translate-y-[10px] items-center gap-3 px-5 py-3">
            <div className="flex h-[56px] flex-1 items-center gap-3 rounded-[22px] border border-white/10 bg-[#FFFFFF]/10 px-5 backdrop-blur-md transition-all focus-within:bg-white/20">
                <img
                    src="/icons/Guest Menu/search-line.svg?v=2"
                    alt="Search"
                    className="h-[18px] w-[18px]"
                />
                <div className="relative flex h-[24px] flex-1 items-center overflow-hidden">
                    {!value && (
                        <div className="pointer-events-none absolute inset-0 flex items-center">
                            <span className="mr-1.5 text-[15px] font-medium text-white/40">
                                Search for
                            </span>
                            <div className="relative h-full flex-1 overflow-hidden">
                                <AnimatePresence mode="popLayout">
                                    <motion.span
                                        key={SEARCH_ITEMS[index]}
                                        initial={{ y: 24, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: -24, opacity: 0 }}
                                        transition={{ duration: 0.4, ease: 'easeInOut' }}
                                        className="absolute left-0 flex h-full items-center text-[15px] font-medium whitespace-nowrap text-white"
                                    >
                                        {SEARCH_ITEMS[index]}
                                    </motion.span>
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {/* REAL INPUT */}
                    <input
                        type="text"
                        value={value || ''}
                        onChange={e => onChange?.(e.target.value)}
                        className="z-10 w-full bg-transparent text-[15px] font-medium text-white focus:outline-none"
                    />
                </div>
            </div>
            <button
                onClick={onFilterTap}
                className="flex h-[56px] w-[56px] items-center justify-center rounded-[22px] border border-white/10 bg-white/10 backdrop-blur-md transition-all active:scale-95"
            >
                <img src="/icons/Guest Menu/filter-line.svg?v=2" alt="Filter" className="h-5 w-5" />
            </button>
        </div>
    );
};
