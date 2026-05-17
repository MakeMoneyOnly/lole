'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface TabItem {
    id: number;
    label: string;
    iconFill: string;
    iconLine: string;
}

const TABS: TabItem[] = [
    {
        id: 0,
        label: 'Home',
        iconFill: '/icons/Guest Menu/home-fill.svg?v=2',
        iconLine: '/icons/Guest Menu/home-line.svg?v=2',
    },
    {
        id: 4,
        label: 'Offers',
        iconFill: '/icons/Guest Menu/discount-fill.svg?v=2',
        iconLine: '/icons/Guest Menu/discount-line.svg?v=2',
    },
    {
        id: 1,
        label: 'Pay',
        iconFill: '/icons/Guest Menu/wallet-fill.svg?v=2',
        iconLine: '/icons/Guest Menu/wallet-line.svg?v=2',
    },
    {
        id: 3,
        label: 'Cart',
        iconFill: '/icons/Guest Menu/cart-fill.svg?v=2',
        iconLine: '/icons/Guest Menu/cart-line.svg?v=2',
    },
    {
        id: 2,
        label: 'Profile',
        iconFill: '/icons/Guest Menu/profile-fill.svg?v=2',
        iconLine: '/icons/Guest Menu/profile-line.svg?v=2',
    },
];

export const GuestMenuBottomNav: React.FC<{
    activeIndex: number;
    onIndexChange: (index: number) => void;
    isOnlineOrderMode?: boolean;
}> = ({ activeIndex, onIndexChange, isOnlineOrderMode: _isOnlineOrderMode }) => {
    return (
        <div className="fixed right-0 bottom-3 left-0 z-50 flex justify-center px-6">
            <div className="flex h-[66px] w-full max-w-[420px] items-center justify-between rounded-[24px] border border-white/5 bg-[#000000] px-[8px] shadow-2xl shadow-black/60 backdrop-blur-md">
                {TABS.map(tab => {
                    const isActive = activeIndex === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => onIndexChange(tab.id)}
                            className="relative flex h-[48px] items-center justify-center transition-all focus:outline-none"
                        >
                            {/* Animated Background Pill */}
                            {isActive && (
                                <motion.div
                                    layoutId="activeNavPill"
                                    className="absolute inset-0 rounded-[16px] bg-[#DDF853]"
                                    transition={{
                                        type: 'spring',
                                        stiffness: 380,
                                        damping: 30,
                                    }}
                                />
                            )}

                            {/* Icon & Label Content */}
                            <div
                                className={cn(
                                    'relative z-10 flex h-full items-center justify-center gap-2 rounded-[16px] px-3 transition-all duration-300 ease-out',
                                    isActive
                                        ? 'font-inter text-[14px] font-normal text-[#000000]'
                                        : 'w-[46px] text-white/50 hover:text-white/90'
                                )}
                            >
                                <img
                                    src={isActive ? tab.iconFill : tab.iconLine}
                                    alt={tab.label}
                                    className="h-[22px] w-[22px]"
                                />
                                {isActive && (
                                    <span className="font-inter text-[13px] font-normal tracking-tight whitespace-nowrap select-none">
                                        {tab.label}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
