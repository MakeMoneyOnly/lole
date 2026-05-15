'use client';

import React from 'react';
import { Menu, Bell } from 'lucide-react';

interface HeaderIconProps {
    icon: React.ElementType;
    onTap?: () => void;
}

const HeaderIcon: React.FC<HeaderIconProps> = ({ icon: Icon, onTap }) => {
    return (
        <button
            onClick={onTap}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-[#FFFFFF] border border-brand-neutral-soft/10 transition-all hover:bg-gray-50 active:scale-95"
            aria-label="Header Action"
        >
            <Icon className="h-[22px] w-[22px] text-black" />
        </button>
    );
};

export const GuestMenuHeader: React.FC = () => {
    return (
        <header className="flex w-full items-center justify-between px-5 py-[7px]">
            <HeaderIcon icon={Menu} />
            <HeaderIcon icon={Bell} />
        </header>
    );
};
