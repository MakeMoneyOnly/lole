'use client';
import React from 'react';
import { cn } from '@/lib/utils';
import { Zap, Apple, Wind } from 'lucide-react';

const BRANDS = [
    { id: 'nike', name: 'Nike', icon: <Zap size={24} className="fill-black" /> },
    { id: 'apple', name: 'Apple', icon: <Apple size={24} className="fill-black" /> },
    {
        id: 'dji',
        name: 'DJI',
        icon: <div className="text-xl font-black tracking-tighter italic">dji</div>,
    },
    { id: 'adidas', name: 'Adidas', icon: <Zap size={24} className="rotate-12" /> },
    {
        id: 'chanel',
        name: 'CHANEL',
        icon: <div className="text-lg font-black tracking-tighter">CC</div>,
    },
    {
        id: 'gucci',
        name: 'GUCCI',
        icon: <div className="text-lg font-black tracking-tighter">GG</div>,
    },
];

export function BrandRail() {
    return (
        <div className="mb-8 w-full">
            <div className="mx-auto max-w-lg px-6">
                <h2 className="mb-6 text-lg font-black tracking-tighter text-black">
                    Curated Brands
                </h2>
                <div className="no-scrollbar flex gap-6 overflow-x-auto pb-4">
                    {BRANDS.map(brand => (
                        <div key={brand.id} className="flex flex-col items-center gap-3">
                            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-[24px] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.03)] transition-transform active:scale-95">
                                {brand.icon}
                            </div>
                            <span className="text-[10px] font-bold tracking-tight text-black/40">
                                {brand.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
