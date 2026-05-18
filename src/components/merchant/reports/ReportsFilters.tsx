'use client';

import React from 'react';
import { Calendar, Layout, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernSelect } from '../shared/ModernSelect';

export function ReportsFilters(): React.JSX.Element {
    return (
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-3xl border border-gray-100 bg-gray-50/30 p-4">
            {/* Date Range Picker Placeholder */}
            <div className="flex h-12 min-w-[320px] items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 shadow-none transition-all hover:border-gray-200">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div className="flex flex-1 items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">Apr 21, 2026</span>
                    <span className="text-xs font-medium text-gray-400">—</span>
                    <span className="text-sm font-bold text-gray-900">Apr 21, 2026</span>
                </div>
                <div className="ml-2 flex items-center gap-1 rounded-lg bg-[#DDF853]/10 px-2 py-1">
                    <span className="text-[10px] font-bold text-[#98AD17]">ET 🇪🇹</span>
                </div>
                <ChevronDown className="ml-2 h-4 w-4 text-gray-400" />
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2">
                {['Today', 'Yesterday', 'Last 7 Days', 'This Month'].map(range => (
                    <button
                        key={range}
                        className={cn(
                            'h-12 rounded-2xl px-4 text-sm font-bold transition-all active:scale-95',
                            range === 'Today'
                                ? 'bg-black text-white'
                                : 'border border-gray-100 bg-white text-gray-600 shadow-none hover:border-gray-200'
                        )}
                    >
                        {range}
                    </button>
                ))}
            </div>

            {/* Separator */}
            <div className="mx-2 hidden h-8 w-px bg-gray-200 lg:block" />

            {/* Global Selectors */}
            <div className="flex min-w-[200px] flex-1 gap-3">
                <div className="w-full max-w-[200px]">
                    <ModernSelect
                        className="h-12"
                        options={[
                            { value: 'all', label: 'All Locations' },
                            { value: 'main', label: 'Main Branch (Addis)' },
                            { value: 'bole', label: 'Bole Subcity' },
                        ]}
                    />
                </div>
                <div className="w-full max-w-[180px]">
                    <ModernSelect
                        className="h-12"
                        options={[
                            { value: 'all', label: 'Revenue Centers' },
                            { value: 'dine-in', label: 'Main Dining' },
                            { value: 'patio', label: 'Outdoor Patio' },
                            { value: 'bar', label: 'Lounge Bar' },
                        ]}
                    />
                </div>
                <div className="w-full max-w-[160px]">
                    <ModernSelect
                        className="h-12"
                        options={[
                            { value: 'all', label: 'All Channels' },
                            { value: 'dine', label: 'Dine-in' },
                            { value: 'takeout', label: 'Takeout' },
                            { value: 'delivery', label: 'Delivery' },
                        ]}
                    />
                </div>
            </div>

            {/* Compare Toggle */}
            <button className="flex h-12 items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 text-sm font-bold text-gray-600 shadow-none transition-all hover:bg-gray-50 active:scale-95">
                <Layout className="h-4 w-4" />
                Compare
            </button>
        </div>
    );
}
