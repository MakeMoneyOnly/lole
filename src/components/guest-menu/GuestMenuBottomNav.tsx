'use client';

import React from 'react';
import { House, Store, TrendingUp, ShoppingBag, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GUEST_MENU_GRADIENT } from './shared/GuestMenuGradient';

interface NavItemProps {
    icon: React.ElementType;
    label: string;
    isActive: boolean;
    onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex flex-1 flex-col items-center justify-center gap-1 transition-all active:scale-90"
        >
            <Icon 
                className={cn(
                    "h-6 w-6 transition-colors",
                    isActive ? "text-black" : "text-gray-400"
                )} 
            />
            <span className={cn(
                "text-[10px] font-medium tracking-tight",
                isActive ? "text-black font-bold" : "text-gray-400 font-normal"
            )}>
                {label}
            </span>
        </button>
    );
};

export const GuestMenuBottomNav: React.FC<{
    activeIndex: number;
    onIndexChange: (index: number) => void;
}> = ({ activeIndex, onIndexChange }) => {
    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-safe">
            <div className="relative flex h-[76px] w-full max-w-md items-center bg-[#FFFFFF] px-2 border-t border-brand-neutral-soft/10">
                <NavItem 
                    icon={House} 
                    label="Home" 
                    isActive={activeIndex === 0} 
                    onClick={() => onIndexChange(0)} 
                />
                <NavItem 
                    icon={Store} 
                    label="Shops" 
                    isActive={activeIndex === 1} 
                    onClick={() => onIndexChange(1)} 
                />
                
                {/* Center Space for FAB */}
                <div className="flex flex-1 flex-col items-center justify-end pb-2">
                    <button
                        onClick={() => onIndexChange(2)}
                        className="absolute -top-8 flex h-[70px] w-[70px] items-center justify-center rounded-full border-[6px] border-[#FFFFFF] transition-transform active:scale-90"
                        style={{ background: GUEST_MENU_GRADIENT }}
                    >
                        <TrendingUp className="h-8 w-8 text-black" />
                    </button>
                    <span className={cn(
                        "text-[10px] font-medium tracking-tight mt-1",
                        activeIndex === 2 ? "text-black font-bold" : "text-gray-400 font-normal"
                    )}>
                        Trends
                    </span>
                </div>

                <NavItem 
                    icon={ShoppingBag} 
                    label="Cart" 
                    isActive={activeIndex === 3} 
                    onClick={() => onIndexChange(3)} 
                />
                <NavItem 
                    icon={User} 
                    label="Profile" 
                    isActive={activeIndex === 4} 
                    onClick={() => onIndexChange(4)} 
                />
            </div>
        </div>
    );
};
