'use client';

import React from 'react';
import { Settings, Zap, AlertCircle, CheckCircle2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernSelect } from '../../shared/ModernSelect';

export function StrategiesView(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                            <Settings className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Quote Time Strategy</h3>
                    </div>

                    <div className="space-y-3">
                        {[
                            {
                                id: 'manual',
                                label: 'Manual Quote Times',
                                desc: 'Staff manually sets the prep time for each order',
                            },
                            {
                                id: 'capacity',
                                label: 'Kitchen Capacity',
                                desc: 'Calculated based on 15-minute slot volume (Toast POS Standard)',
                                active: true,
                            },
                            {
                                id: 'price',
                                label: 'Order Price Throttling',
                                desc: 'Adds prep time based on total basket value (e.g. +10m per 500 ETB)',
                            },
                            {
                                id: 'smart',
                                label: 'Smart Quote (AI)',
                                desc: 'Uses machine learning to calculate times based on historical data',
                                beta: true,
                            },
                        ].map(strategy => (
                            <button
                                key={strategy.id}
                                className={cn(
                                    'relative flex w-full items-center justify-between overflow-hidden rounded-2xl border p-5 text-left transition-all outline-none',
                                    strategy.active
                                        ? 'border-brand-accent bg-brand-accent/5 ring-brand-accent ring-1'
                                        : 'border-gray-100 bg-gray-50/30 hover:border-gray-200'
                                )}
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-gray-900">
                                            {strategy.label}
                                        </h4>
                                        {strategy.beta && (
                                            <span className="bg-brand-accent/20 rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-black uppercase">
                                                Beta
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div
                                    className={cn(
                                        'flex h-5 w-5 items-center justify-center rounded-full border-2',
                                        strategy.active
                                            ? 'border-brand-accent bg-brand-accent'
                                            : 'border-gray-200'
                                    )}
                                >
                                    {strategy.active && (
                                        <CheckCircle2 className="h-3 w-3 text-black" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                            <Zap className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Auto-Throttle Rules</h3>
                    </div>

                    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/50 p-8 text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-none ring-1 ring-gray-100">
                            <AlertCircle className="h-6 w-6 text-gray-300" />
                        </div>
                        <h4 className="text-sm font-bold text-gray-700">
                            No active throttle rules
                        </h4>
                        <button className="mt-6 rounded-xl bg-gray-900 px-6 py-2.5 text-xs font-bold text-white transition-all hover:bg-black active:scale-95">
                            Create Auto-Rule
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                            <Activity className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">
                            Kitchen Capacity Configuration
                        </h3>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">
                            Max Orders / 15min
                        </label>
                        <input
                            type="text"
                            defaultValue="10"
                            className="focus:ring-brand-accent w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:ring-2"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">
                            Max Items / 15min
                        </label>
                        <input
                            type="text"
                            defaultValue="25"
                            className="focus:ring-brand-accent w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:ring-2"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">
                            Alert Threshold
                        </label>
                        <ModernSelect
                            value="1"
                            onChange={() => {}}
                            options={[
                                { value: '1', label: '80% Capacity' },
                                { value: '2', label: '90% Capacity' },
                                { value: '3', label: '100% Capacity' },
                            ]}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">
                            Snooze Threshold
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                defaultValue="100"
                                className="focus:ring-brand-accent flex-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:ring-2"
                            />
                            <span className="text-xs font-bold text-gray-400">%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
