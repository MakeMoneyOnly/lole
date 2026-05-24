'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = ['11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p', '10p'];

// Mock data: 0 (low) to 1 (high)
const DATA = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => Math.random()));

export function BusyHoursHeatmap(): React.JSX.Element {
    return (
        <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black shadow-none">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Busy Hours Heatmap</h3>
                        <p className="text-[10px] font-bold text-gray-400">
                            Order density by day and hour
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm border border-gray-100 bg-gray-50" />
                        <span className="text-[10px] font-bold text-gray-400">Low</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm bg-[#DDF853]" />
                        <span className="text-[10px] font-bold text-gray-400">Peak</span>
                    </div>
                </div>
            </div>

            <div className="relative">
                {/* Hours Header */}
                <div className="mb-4 ml-12 grid grid-cols-12 gap-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                    {HOURS.map(h => (
                        <div key={h} className="text-center">
                            {h}
                        </div>
                    ))}
                </div>

                <div className="space-y-1">
                    {DAYS.map((day, dIdx) => (
                        <div key={day} className="flex items-center gap-2">
                            <div className="w-10 text-[11px] font-bold text-gray-400 uppercase">
                                {day}
                            </div>
                            <div className="grid flex-1 grid-cols-12 gap-1">
                                {DATA[dIdx].map((val, hIdx) => (
                                    <div
                                        key={hIdx}
                                        className={cn(
                                            'group relative h-10 rounded-lg transition-all hover:scale-105 hover:shadow-none',
                                            val < 0.2
                                                ? 'bg-gray-50/50'
                                                : val < 0.4
                                                  ? 'bg-[#DDF853]/20'
                                                  : val < 0.6
                                                    ? 'bg-[#DDF853]/40'
                                                    : val < 0.8
                                                      ? 'bg-[#DDF853]/70'
                                                      : 'bg-[#DDF853]'
                                        )}
                                    >
                                        <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 rounded-lg bg-black px-2 py-1 text-[10px] font-bold whitespace-nowrap text-white group-hover:block">
                                            {Math.round(val * 100)} orders
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-8 rounded-2xl border border-gray-100/50 bg-gray-50/50 p-4">
                <p className="text-xs font-semibold text-gray-600">
                    <span className="font-bold text-gray-900">Insight:</span> Your peak hour is{' '}
                    <span className="font-bold text-black underline decoration-[#DDF853] decoration-2">
                        Friday at 8 PM
                    </span>
                    . Consider increasing staff by 20% during this window.
                </p>
            </div>
        </div>
    );
}
