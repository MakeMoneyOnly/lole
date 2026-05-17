'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

import { Home, Tag, Wallet, ShoppingBag, User } from 'lucide-react';

interface TabItem {
    id: number;
    label: string;
    icon: React.ElementType;
}

const TABS: TabItem[] = [
    { id: 0, label: 'Home', icon: Home },
    { id: 4, label: 'Offers', icon: Tag },
    { id: 1, label: 'Pay', icon: Wallet },
    { id: 3, label: 'Cart', icon: ShoppingBag },
    { id: 2, label: 'Profile', icon: User },
];

export const GuestMenuBottomNav: React.FC<{
    activeIndex: number;
    onIndexChange: (index: number) => void;
    isOnlineOrderMode?: boolean;
}> = ({ activeIndex, onIndexChange, isOnlineOrderMode: _isOnlineOrderMode }) => {
    return (
        <div className="fixed bottom-3 left-0 right-0 z-50 flex justify-center px-6">
            <div className="flex h-[66px] w-full max-w-[420px] items-center justify-between rounded-[24px] bg-[#000000] px-[8px] shadow-2xl shadow-black/60 border border-white/5 backdrop-blur-md">
                {TABS.map((tab) => {
                    const isActive = activeIndex === tab.id;
                    const Icon = tab.icon;

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
                                    className="absolute inset-0 bg-[#DDF853] rounded-[16px]"
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
                                    "relative z-10 flex items-center justify-center gap-2 h-full rounded-[16px] transition-all duration-300 ease-out px-3",
                                    isActive
                                        ? "text-[#000000] font-normal font-inter text-[14px]"
                                        : "text-white/50 hover:text-white/90 w-[46px]"
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "h-[22px] w-[22px]",
                                        isActive ? "stroke-[2.2]" : "stroke-[1.8]"
                                    )}
                                />
                                {isActive && (
                                    <span className="font-normal font-inter text-[13px] tracking-tight whitespace-nowrap select-none">
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
