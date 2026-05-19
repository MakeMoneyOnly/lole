'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import Image from 'next/image';

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
        iconFill: '/icons/Guest%20Menu/home-fill.svg?v=2',
        iconLine: '/icons/Guest%20Menu/home-line.svg?v=2',
    },
    {
        id: 4,
        label: 'Offers',
        iconFill: '/icons/Guest%20Menu/discount-fill.svg?v=2',
        iconLine: '/icons/Guest%20Menu/discount-line.svg?v=2',
    },
    {
        id: 1,
        label: 'Pay',
        iconFill: '/icons/Guest%20Menu/wallet-fill.svg?v=2',
        iconLine: '/icons/Guest%20Menu/wallet-line.svg?v=2',
    },
    {
        id: 3,
        label: 'Cart',
        iconFill: '/icons/Guest%20Menu/cart-fill.svg?v=2',
        iconLine: '/icons/Guest%20Menu/cart-line.svg?v=2',
    },
    {
        id: 2,
        label: 'Profile',
        iconFill: '/icons/Guest%20Menu/profile-fill.svg?v=2',
        iconLine: '/icons/Guest%20Menu/profile-line.svg?v=2',
    },
];

export const GuestMenuBottomNav: React.FC<{
    activeIndex: number;
    onIndexChange: (index: number) => void;
    isOnlineOrderMode?: boolean;
    cartCount?: number;
}> = ({ activeIndex, onIndexChange, isOnlineOrderMode: _isOnlineOrderMode, cartCount = 0 }) => {
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
                                <div className="relative">
<Image
                                            src={isActive ? tab.iconFill : tab.iconLine}
                                            alt={tab.label}
                                            className="h-[22px] w-[22px]"
                                            width={22}
                                            height={22}
                                            unoptimized={true}
                                        />
                                    {tab.id === 3 && cartCount > 0 && (
                                        <span className={cn(
                                            "absolute -top-2 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold shadow-sm border border-black transition-all",
                                            isActive ? "bg-[#000000] text-[#DDF853] border-white/20" : "bg-[#DDF853] text-[#000000]"
                                        )}>
                                            {cartCount}
                                        </span>
                                    )}
                                </div>
                                {isActive && (
                                    <span className="font-inter text-[13px] font-bold tracking-[-0.04em] whitespace-nowrap select-none">
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
