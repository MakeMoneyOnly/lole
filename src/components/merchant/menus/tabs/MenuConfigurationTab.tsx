'use client';

import React from 'react';
import { Clock, RefreshCw } from 'lucide-react';

export function MenuConfigurationTab(): React.JSX.Element {
    return (
        <div className="flex max-w-6xl gap-8">
            {/* Left Column: Forms */}
            <div className="flex-1 space-y-8">
                {/* Pricing Rules */}
                <div className="overflow-hidden rounded-[2rem] border-b border-gray-100 bg-white">
                    <div className="border-b border-gray-200 px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
                                <Clock className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900">
                                    Pricing Rules & Happy Hour
                                </h3>
                                <p className="text-sm font-medium text-gray-500">
                                    Configure time-based price adjustments
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6 p-6">
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                            <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-gray-300 text-black focus:ring-black"
                            />
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900">
                                    Enable Time-based Pricing
                                </span>
                                <span className="text-xs font-medium text-gray-500">
                                    Automatically adjust prices during specific hours
                                </span>
                            </div>
                        </label>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-700">
                                    Start Time
                                </label>
                                <input
                                    type="time"
                                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-700">End Time</label>
                                <input
                                    type="time"
                                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-700">
                                Price Adjustment
                            </label>
                            <div className="flex items-center gap-3">
                                <select className="w-1/3 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none">
                                    <option>Decrease by %</option>
                                    <option>Decrease by amount</option>
                                </select>
                                <input
                                    type="number"
                                    placeholder="10"
                                    className="w-2/3 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Online Ordering Sync */}
                <div className="overflow-hidden rounded-[2rem] border-b border-gray-100 bg-white">
                    <div className="border-b border-gray-200 px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                                <RefreshCw className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900">
                                    Online Ordering Menu Sync
                                </h3>
                                <p className="text-sm font-medium text-gray-500">
                                    Keep POS and online menus in sync
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6 p-6">
                        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900">
                                    Auto-sync POS menu
                                </span>
                                <span className="text-xs font-medium text-gray-500">
                                    Automatically push changes to delivery partners
                                </span>
                            </div>
                            <div className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-black transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-black focus:ring-offset-2 focus:outline-none">
                                <span
                                    aria-hidden="true"
                                    className="pointer-events-none inline-block h-5 w-5 translate-x-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                                ></span>
                            </div>
                        </label>
                        <p className="text-right text-xs font-medium text-gray-500">
                            Last synced: Today at 09:42 AM
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Column: Context/Info */}
            <div className="w-80 shrink-0 space-y-4">
                <div className="rounded-[2rem] border-b border-gray-100 bg-gray-50 p-5">
                    <h4 className="mb-2 text-sm font-bold text-gray-900">How Pricing Rules Work</h4>
                    <p className="text-xs leading-relaxed font-medium text-gray-600">
                        Pricing rules allow you to automatically change the cost of items based on
                        the time of day. This is commonly used for Happy Hour specials or late-night
                        menus.
                    </p>
                </div>
            </div>
        </div>
    );
}
