'use client';
import React from 'react';
import { CreditCard, Award, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardsProps {
    balance?: string;
    points?: string;
}

export function MetricCards({ balance = '$1920.10', points = '19204' }: MetricCardsProps) {
    return (
        <div className="mb-8 w-full px-6">
            <div className="mx-auto max-w-lg">
                <div className="flex gap-4">
                    {/* Balance Card */}
                    <div className="flex flex-1 items-center gap-4 rounded-[32px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-transform active:scale-[0.98]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8F9FA]">
                            <CreditCard size={22} className="text-black" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold tracking-tight text-black/30">
                                Balance
                            </span>
                            <span className="text-sm font-black tracking-tight text-black">
                                {balance}
                            </span>
                        </div>
                    </div>

                    {/* Points Card */}
                    <div className="flex flex-1 items-center gap-4 rounded-[32px] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-transform active:scale-[0.98]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8F9FA]">
                            <Settings size={22} className="text-black" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold tracking-tight text-black/30">
                                Points
                            </span>
                            <span className="text-sm font-black tracking-tight text-black">
                                {points}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
