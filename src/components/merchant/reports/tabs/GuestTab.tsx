'use client';

import React from 'react';
import { Heart, Users, Star, Award, Info, ArrowRight } from 'lucide-react';
import { ModernSelect } from '../../shared/ModernSelect';

export function GuestTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Visit Frequency */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Users className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-bold text-gray-900">Visit Frequency</h3>
                                <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                            </div>
                        </div>
                        <div className="w-32">
                            <ModernSelect
                                options={[
                                    { value: '30d', label: 'Last 30 Days' },
                                    { value: '7d', label: 'Last 7 Days' },
                                    { value: 'ytd', label: 'Year to Date' },
                                ]}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        {[
                            [
                                {
                                    label: 'New Guests',
                                    value: '1,245',
                                    change: '+12%',
                                    isUp: true,
                                    type: 'bar1',
                                },
                                {
                                    label: 'Returning Guests',
                                    value: '856',
                                    change: '+5%',
                                    isUp: true,
                                    type: 'bar2',
                                },
                            ],
                        ].map((pair, i) => (
                            <div
                                key={i}
                                className="flex min-h-[200px] flex-col rounded-3xl border border-gray-100 bg-gray-50/30"
                            >
                                <div className="flex flex-1">
                                    {pair.map((metric, j) => (
                                        <div
                                            key={j}
                                            className={`flex flex-1 flex-col p-6 ${j === 0 ? 'border-r border-gray-100' : ''}`}
                                        >
                                            <div>
                                                <div className="-mt-2.5 mb-0 flex h-11 items-center gap-2">
                                                    <h3 className="overflow-hidden text-base font-medium text-ellipsis whitespace-nowrap text-gray-400">
                                                        {metric.label}
                                                    </h3>
                                                    <Info
                                                        strokeWidth={1.5}
                                                        className="h-4 w-4 text-gray-300"
                                                    />
                                                </div>

                                                <div className="flex items-end justify-between">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="-mt-2 flex items-baseline gap-1.5">
                                                            <span className="text-3xl font-bold text-black">
                                                                {metric.value}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                                                            vs last period
                                                            <span
                                                                className={`flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                                                                    metric.isUp
                                                                        ? 'bg-green-50 text-green-600'
                                                                        : 'bg-red-50 text-red-600'
                                                                }`}
                                                            >
                                                                {metric.change}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {metric.type === 'bar1' && (
                                                        <div className="flex h-10 items-end gap-1.5">
                                                            <div className="bg-brand-accent/30 h-4 w-2 rounded-t-sm"></div>
                                                            <div className="bg-brand-accent h-9 w-2 rounded-t-sm"></div>
                                                            <div className="bg-brand-accent/30 h-5 w-2 rounded-t-sm"></div>
                                                            <div className="bg-brand-accent/30 h-3 w-2 rounded-t-sm"></div>
                                                        </div>
                                                    )}
                                                    {metric.type === 'bar2' && (
                                                        <div className="flex h-10 items-end gap-1.5">
                                                            <div className="bg-brand-accent/30 h-3 w-2 rounded-t-sm"></div>
                                                            <div className="bg-brand-accent/30 h-6 w-2 rounded-t-sm"></div>
                                                            <div className="bg-brand-accent h-9 w-2 rounded-t-sm"></div>
                                                            <div className="bg-brand-accent/30 h-4 w-2 rounded-t-sm"></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex border-t border-gray-100">
                                    <button className="group flex flex-1 items-center justify-center gap-2 rounded-bl-3xl border-r border-gray-100 bg-gray-100/50 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-100">
                                        See details{' '}
                                        <ArrowRight
                                            strokeWidth={2}
                                            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-rotate-12"
                                        />
                                    </button>
                                    <button className="group flex flex-1 items-center justify-center gap-2 rounded-br-3xl bg-gray-100/50 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-100">
                                        See details{' '}
                                        <ArrowRight
                                            strokeWidth={2}
                                            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-rotate-12"
                                        />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mt-8 space-y-4 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">Return Rate</span>
                        <span className="text-lg font-bold text-black">40.7%</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full w-[40.7%] bg-[#DDF853]"></div>
                    </div>
                    <p className="mt-2 text-xs font-bold text-gray-400">Industry average is 30%</p>
                </div>
            </div>

            {/* Loyalty Report */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Award className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">Loyalty Report</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#DDF853] shadow-[0_0_8px_rgba(221,248,83,0.8)]"></div>
                        <span className="text-xs font-bold text-gray-500">Active</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-gray-50/10 p-4">
                        <div className="mb-2 flex items-start justify-between">
                            <p className="text-xs font-bold text-gray-400">Points Issued</p>
                            <Star className="h-4 w-4 fill-[#DDF853] text-[#DDF853]" />
                        </div>
                        <p className="text-lg font-bold text-gray-900">125,400</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50/10 p-4">
                        <div className="mb-2 flex items-start justify-between">
                            <p className="text-xs font-bold text-gray-400">Points Redeemed</p>
                            <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                        </div>
                        <p className="text-lg font-bold text-gray-900">45,200</p>
                    </div>
                </div>

                <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4">
                        <span className="text-sm font-bold text-gray-400">
                            Active Loyalty Members
                        </span>
                        <span className="text-base font-bold text-gray-900">3,450</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-[#DDF853]/20 p-4">
                        <span className="text-sm font-bold text-gray-900">Redemption Rate</span>
                        <span className="text-lg font-bold text-black">36%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
