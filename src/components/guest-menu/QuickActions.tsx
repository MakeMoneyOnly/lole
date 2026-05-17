'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
    Heart, 
    BellRing, 
    Star, 
    Gift, 
    ClipboardList, 
    Tag 
} from 'lucide-react';

interface QuickActionProps {
    icon: React.ElementType;
    label: string;
    onTap: () => void;
    active?: boolean;
}

export const QuickAction: React.FC<QuickActionProps> = ({ icon: Icon, label, onTap, active }) => {
    return (
        <button
            onClick={onTap}
            className="flex flex-col items-center gap-2 transition-transform active:scale-95"
        >
            <div className={cn(
                "flex h-[58px] w-[58px] items-center justify-center rounded-[20px] transition-all shadow-sm",
                active ? "bg-[#DDF853] text-black" : "bg-[#1A1C1E] text-white"
            )}>
                <Icon className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <span className="text-[12px] font-semibold text-[#1A1C1E]/80 tracking-tight">
                {label}
            </span>
        </button>
    );
};

export const QuickActionsGrid: React.FC<{ isOnlineOrderMode: boolean }> = ({ isOnlineOrderMode }) => {
    return (
        <div className="grid grid-cols-5 gap-2 px-5 pt-4 pb-6">
            <QuickAction
                icon={Star}
                label="Loyalty"
                onTap={() => {}}
            />
            <QuickAction
                icon={Gift}
                label="Gift Cards"
                onTap={() => {}}
            />
            <QuickAction
                icon={isOnlineOrderMode ? Heart : BellRing}
                label={isOnlineOrderMode ? "Favorites" : "Service"}
                onTap={() => {
                    if (!isOnlineOrderMode) {
                        alert("Staff notified! Someone will be with you shortly.");
                    }
                }}
            />
            <QuickAction
                icon={ClipboardList}
                label="My Orders"
                onTap={() => {}}
            />
            <QuickAction
                icon={Tag}
                label="Offers"
                onTap={() => {}}
            />
        </div>
    );
};
