'use client';

import React from 'react';
import { MapPin, Bell, Inbox } from 'lucide-react';
import Image from 'next/image';

interface HeaderIconProps {
    icon: React.ElementType;
    onTap?: () => void;
    hasNotification?: boolean;
}

const HeaderIcon: React.FC<HeaderIconProps> = ({ icon: Icon, onTap, hasNotification }) => {
    return (
        <button
            onClick={onTap}
            className="relative flex h-[48px] w-[40px] items-center justify-center transition-all active:scale-95"
            aria-label="Header Action"
        >
            <Icon className="h-[24px] w-[24px] text-white" strokeWidth={2} />
            {hasNotification && (
                <div className="absolute right-1.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[#DDF853]" />
            )}
        </button>
    );
};

export const GuestMenuHeader: React.FC = () => {
    return (
        <header className="flex w-full items-center justify-between px-5 pt-5 pb-1">
            <div className="flex items-center gap-3">
                {/* User Avatar */}
                <div className="relative h-12 w-12 overflow-hidden rounded-[18px]">
                    <Image
                        src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=880&auto=format&fit=crop"
                        alt="User Avatar"
                        fill
                        className="object-cover"
                    />
                </div>

                <div className="flex flex-col gap-0">
                    <h1 className="text-[16px] font-bold text-white tracking-tight leading-tight">
                        Hello Dawit Bekele
                    </h1>
                    <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[#DDF853]" />
                        <span className="text-[13px] font-medium text-white/70">
                            Bole, Addis Ababa
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1">
                <HeaderIcon icon={Inbox} />
                <HeaderIcon icon={Bell} hasNotification />
            </div>
        </header>
    );
};
