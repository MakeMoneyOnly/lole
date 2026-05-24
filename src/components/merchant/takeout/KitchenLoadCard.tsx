'use client';

import React from 'react';
import { Activity, Info, History, ArrowUpRight } from 'lucide-react';
import SalesPerformanceChart from '@/components/merchant/shared/SalesPerformanceChart';

export function KitchenLoadCard(): React.JSX.Element {
    return (
        <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-none">
            <div className="flex flex-1 flex-col gap-6 p-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">Live Kitchen Pacing</h3>
                            <Info className="h-4 w-4 cursor-help text-gray-300" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-10">
                        <div className="space-y-1">
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-bold text-gray-900">8 / 15</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-500">
                                Orders in current 15min slot
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="border-brand-accent flex flex-col border-l-2 pl-3">
                                <span className="text-xs font-medium text-gray-400">
                                    P95 Ticket Time
                                </span>
                                <span className="text-sm font-bold text-gray-900">18m 20s</span>
                            </div>
                            <div className="flex flex-col border-l-2 border-gray-100 pl-3">
                                <span className="text-xs font-medium text-gray-400">Avg Prep</span>
                                <span className="text-sm font-bold text-gray-900">12m 45s</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 pr-12">
                        <div className="relative flex h-35 w-48 items-center justify-center">
                            <div className="h-full w-full origin-bottom translate-y-25 scale-[2.1]">
                                <SalesPerformanceChart totalSales={53} averageSales={35} />
                            </div>
                        </div>
                        <span className="-translate-y-5 text-xs font-medium text-gray-400">
                            Kitchen Capacity
                        </span>
                    </div>
                </div>
            </div>

            <button className="group flex w-full items-center justify-center gap-2 border-t border-gray-50 bg-gray-50/50 py-4 text-sm font-bold text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-900">
                <History className="h-4 w-4" />
                Detailed Capacity Logs
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
        </div>
    );
}
