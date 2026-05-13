'use client';
import React from 'react';
import { Menu, Bell } from 'lucide-react';
import { useHaptic } from '@/hooks/useHaptic';

export function MartrezaHeader() {
    const { trigger } = useHaptic();

    return (
        <div className="flex items-center justify-between px-6 py-4">
            <button
                onClick={() => trigger('soft')}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-transparent transition-transform active:scale-95"
            >
                <Menu size={26} className="text-white drop-shadow-md" />
            </button>
            <button
                onClick={() => trigger('soft')}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-transparent transition-transform active:scale-95"
            >
                <Bell size={26} className="text-white drop-shadow-md" />
            </button>
        </div>
    );
}
