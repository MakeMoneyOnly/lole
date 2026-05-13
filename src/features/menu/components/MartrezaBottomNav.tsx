'use client';
import React from 'react';
import { Home, Store, TrendingUp, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useHaptic';

export function MartrezaBottomNav() {
    const { trigger } = useHaptic();
    const [activeTab, setActiveTab] = React.useState(0);

    const handleTabClick = (index: number) => {
        trigger('soft');
        setActiveTab(index);
    };

    return (
        <div className="pointer-events-none fixed right-0 bottom-0 left-0 z-[100] h-[112px]">
            {/* The Notched Background Container */}
            <div className="pointer-events-auto absolute bottom-0 h-[68px] w-full">
                {/* SVG for the Notched Background */}
                <svg
                    width="100%"
                    height="68"
                    viewBox="0 0 400 68"
                    preserveAspectRatio="none"
                    className="absolute top-0 left-0 h-full w-full"
                >
                    <path d="M0 0 L160 0 A40 40 0 0 0 240 0 L400 0 V68 H0 Z" fill="#F5F5F5" />
                </svg>

                {/* Nav Items Container */}
                <div className="relative mx-auto flex h-full max-w-lg items-center justify-around px-4">
                    <button
                        onClick={() => handleTabClick(0)}
                        className="z-10 flex flex-col items-center gap-0.5"
                    >
                        <Home
                            size={22}
                            className={cn(
                                'transition-colors',
                                activeTab === 0 ? 'text-black' : 'text-black/30'
                            )}
                        />
                        <span
                            className={cn(
                                'text-[10px]',
                                activeTab === 0 ? 'font-bold' : 'font-normal text-black/30'
                            )}
                        >
                            Home
                        </span>
                    </button>

                    <button
                        onClick={() => handleTabClick(1)}
                        className="z-10 flex flex-col items-center gap-0.5"
                    >
                        <Store
                            size={22}
                            className={cn(
                                'transition-colors',
                                activeTab === 1 ? 'text-black' : 'text-black/30'
                            )}
                        />
                        <span
                            className={cn(
                                'text-[10px]',
                                activeTab === 1 ? 'font-bold' : 'font-normal text-black/30'
                            )}
                        >
                            Shops
                        </span>
                    </button>

                    {/* Gap for FAB */}
                    <div className="w-[80px]" />

                    <button
                        onClick={() => handleTabClick(3)}
                        className="z-10 flex flex-col items-center gap-0.5"
                    >
                        <ShoppingBag
                            size={22}
                            className={cn(
                                'transition-colors',
                                activeTab === 3 ? 'text-black' : 'text-black/30'
                            )}
                        />
                        <span
                            className={cn(
                                'text-[10px]',
                                activeTab === 3 ? 'font-bold' : 'font-normal text-black/30'
                            )}
                        >
                            Cart
                        </span>
                    </button>

                    <button
                        onClick={() => handleTabClick(4)}
                        className="z-10 flex flex-col items-center gap-0.5"
                    >
                        <User
                            size={22}
                            className={cn(
                                'transition-colors',
                                activeTab === 4 ? 'text-black' : 'text-black/30'
                            )}
                        />
                        <span
                            className={cn(
                                'text-[10px]',
                                activeTab === 4 ? 'font-bold' : 'font-normal text-black/30'
                            )}
                        >
                            Profile
                        </span>
                    </button>
                </div>
            </div>

            {/* Floating Action Button */}
            <div className="pointer-events-auto absolute bottom-8 left-1/2 -translate-x-1/2">
                <button
                    onClick={() => handleTabClick(2)}
                    className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#ddf853] shadow-[0_12px_24px_rgba(221,248,83,0.4)] transition-transform active:scale-90"
                >
                    <TrendingUp size={32} className="text-black" />
                </button>
            </div>
        </div>
    );
}
