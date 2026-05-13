'use client';
import React from 'react';
import { Home, ClipboardList, MessageSquare, Heart, User, Search, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useHaptic';

export function BottomNavigation() {
    const { trigger } = useHaptic();
    const [activeTab, setActiveTab] = React.useState('home');

    const handleTabClick = (id: string) => {
        trigger('soft');
        setActiveTab(id);
    };

    return (
        <div className="pb-safe fixed right-0 bottom-0 left-0 z-[100]">
            <div className="mx-auto flex max-w-lg items-center justify-between border-t border-gray-100 bg-white/80 px-10 py-4 backdrop-blur-xl">
                {/* Home */}
                <button
                    onClick={() => handleTabClick('home')}
                    className="relative flex flex-col items-center gap-1 transition-transform active:scale-90"
                >
                    <div
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
                            activeTab === 'home' ? 'bg-blue-50 text-[#007AFF]' : 'text-black/30'
                        )}
                    >
                        <Home size={22} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                    </div>
                    {activeTab === 'home' && (
                        <div className="absolute -bottom-1 h-1 w-1 rounded-full bg-[#007AFF]" />
                    )}
                </button>

                {/* Orders */}
                <button
                    onClick={() => handleTabClick('orders')}
                    className="flex flex-col items-center gap-1 transition-transform active:scale-90"
                >
                    <div
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-xl',
                            activeTab === 'orders' ? 'text-[#007AFF]' : 'text-black/30'
                        )}
                    >
                        <ClipboardList size={22} strokeWidth={2} />
                    </div>
                </button>

                {/* Support */}
                <button
                    onClick={() => handleTabClick('support')}
                    className="flex flex-col items-center gap-1 transition-transform active:scale-90"
                >
                    <div
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-xl',
                            activeTab === 'support' ? 'text-[#007AFF]' : 'text-black/30'
                        )}
                    >
                        <MessageSquare size={22} strokeWidth={2} />
                    </div>
                </button>

                {/* Favorites */}
                <button
                    onClick={() => handleTabClick('favorites')}
                    className="flex flex-col items-center gap-1 transition-transform active:scale-90"
                >
                    <div
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-xl',
                            activeTab === 'favorites' ? 'text-[#007AFF]' : 'text-black/30'
                        )}
                    >
                        <Heart size={22} strokeWidth={2} />
                    </div>
                </button>

                {/* Profile */}
                <button
                    onClick={() => handleTabClick('profile')}
                    className="flex flex-col items-center gap-1 transition-transform active:scale-90"
                >
                    <div
                        className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-xl',
                            activeTab === 'profile' ? 'text-[#007AFF]' : 'text-black/30'
                        )}
                    >
                        <User size={22} strokeWidth={2} />
                    </div>
                </button>
            </div>
        </div>
    );
}
