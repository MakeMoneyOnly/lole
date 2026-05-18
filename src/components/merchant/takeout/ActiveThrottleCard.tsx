'use client';

import React from 'react';
import { Zap, Info, RefreshCw, History, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ActiveThrottleCard(): React.JSX.Element {
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-none">
            <div className="flex flex-1 flex-col gap-6 p-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                            <Zap className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">
                                Online Ordering Delay
                            </h3>
                            <Info className="h-4 w-4 cursor-help text-gray-300" />
                        </div>
                    </div>
                    <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 text-gray-500 ring-1 ring-gray-100 transition-all hover:bg-gray-100 active:scale-95">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-gray-900">
                                +10m Buffer Active
                            </span>
                        </div>
                        <span className="text-xs font-medium text-gray-400">Ends in 24m</span>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                        {['+5m', '+10m', '+15m', '+30m'].map(time => (
                            <button
                                key={time}
                                className={cn(
                                    'h-10 rounded-xl px-3 text-sm font-bold transition-all outline-none',
                                    time === '+10m'
                                        ? 'bg-brand-accent text-black hover:opacity-90'
                                        : 'bg-white text-gray-700 ring-1 ring-gray-100 hover:bg-gray-50'
                                )}
                            >
                                {time}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-auto flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-5">
                    <span className="text-xs font-semibold text-gray-500">Custom Delay</span>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            defaultValue="45"
                            className="h-10 w-14 rounded-xl border border-gray-200 bg-white px-2 text-center text-sm font-bold"
                        />
                        <span className="text-xs font-bold text-gray-900">min</span>
                    </div>
                </div>
            </div>

            <button className="group flex w-full items-center justify-center gap-2 border-t border-gray-50 bg-gray-50/50 py-4 text-sm font-bold text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-900">
                <History className="h-4 w-4" />
                Throttle History
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
        </div>
    );
}
