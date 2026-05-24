'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import Image from 'next/image';

interface HeaderIconProps {
    iconSrc: string;
    onTap?: () => void;
    hasNotification?: boolean;
}

const HeaderIcon: React.FC<HeaderIconProps> = ({ iconSrc, onTap, hasNotification }) => {
    return (
        <button
            onClick={onTap}
            className="relative flex h-[48px] w-[40px] items-center justify-center transition-all active:scale-95"
            aria-label="Header Action"
        >
            <Image
                src={iconSrc}
                className="h-[24px] w-[24px]"
                alt="Header Icon"
                width={24}
                height={24}
                unoptimized={true}
            />
            {hasNotification && (
                <div className="absolute top-2.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[#DDF853]" />
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
                        unoptimized={true}
                    />
                </div>

                <div className="flex flex-col gap-0">
                    <h1 className="text-[16px] leading-tight font-bold tracking-[-0.04em] text-white">
                        Hello Dawit Bekele
                    </h1>
                    <div className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[#DDF853]" />
                        <span className="text-[13px] font-medium tracking-[-0.04em] text-white/70">
                            Bole, Addis Ababa
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-1">
                <HeaderIcon iconSrc="/icons/Guest%20Menu/letter-line.svg?v=2" />
                <HeaderIcon iconSrc="/icons/Guest%20Menu/bell-line.svg?v=2" hasNotification />
            </div>
        </header>
    );
};
