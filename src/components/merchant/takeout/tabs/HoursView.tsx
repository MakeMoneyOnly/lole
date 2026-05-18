'use client';

import React from 'react';
import { Clock, History, Plus, MoreHorizontal, AlertCircle, CheckCircle2 } from 'lucide-react';

export function HoursView(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                            <Clock className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Standard Ordering Hours</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-100 bg-white text-gray-900 hover:bg-gray-50">
                            <History className="h-4 w-4" />
                        </button>
                        <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white hover:bg-black">
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {[
                        'Monday',
                        'Tuesday',
                        'Wednesday',
                        'Thursday',
                        'Friday',
                        'Saturday',
                        'Sunday',
                    ].map(day => (
                        <div
                            key={day}
                            className="flex items-center justify-between rounded-2xl border border-gray-50 bg-gray-50/30 p-5 transition-all hover:border-gray-100"
                        >
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-brand-accent relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors">
                                        <div className="absolute right-1 h-3 w-3 translate-x-0 rounded-full bg-white transition-all" />
                                    </div>
                                    <span className="w-24 text-sm font-bold text-gray-900">
                                        {day}
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-none ring-1 ring-gray-100">
                                        <input
                                            type="text"
                                            defaultValue="08:00 AM"
                                            className="w-16 text-center text-xs font-bold text-gray-900 outline-none"
                                        />
                                        <span className="text-gray-300">-</span>
                                        <input
                                            type="text"
                                            defaultValue="02:00 PM"
                                            className="w-16 text-center text-xs font-bold text-gray-900 outline-none"
                                        />
                                        <button className="text-gray-300 hover:text-red-500">
                                            <Plus className="h-3 w-3 rotate-45" />
                                        </button>
                                    </div>

                                    {/* Split Shift Example for Saturday */}
                                    {day === 'Saturday' && (
                                        <div className="border-brand-accent/20 flex items-center gap-2 rounded-xl border-2 bg-white px-3 py-2 shadow-none ring-1 ring-gray-100">
                                            <input
                                                type="text"
                                                defaultValue="05:00 PM"
                                                className="w-16 text-center text-xs font-bold text-gray-900 outline-none"
                                            />
                                            <span className="text-gray-300">-</span>
                                            <input
                                                type="text"
                                                defaultValue="11:00 PM"
                                                className="w-16 text-center text-xs font-bold text-gray-900 outline-none"
                                            />
                                            <button className="text-gray-300 hover:text-red-500">
                                                <Plus className="h-3 w-3 rotate-45" />
                                            </button>
                                        </div>
                                    )}

                                    <button className="hover:bg-brand-accent flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-400 transition-all hover:text-black">
                                        <Plus className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <button className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-white hover:text-gray-900">
                                <MoreHorizontal className="h-5 w-5" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Order Cut-off Strategy</h3>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <button className="border-brand-accent bg-brand-accent/5 flex items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all outline-none">
                        <div className="border-brand-accent bg-brand-accent mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2">
                            <CheckCircle2 className="h-3 w-3 text-black" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold text-gray-900">
                                Accept until exactly closing
                            </h4>
                        </div>
                    </button>

                    <button className="flex items-start gap-4 rounded-2xl border border-gray-100 bg-white p-5 text-left transition-all outline-none hover:border-gray-200">
                        <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-gray-200" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold text-gray-900">
                                Closing Time minus Prep Time
                            </h4>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
