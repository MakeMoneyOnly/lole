'use client';

import React from 'react';
import { Banknote, Settings2, Users } from 'lucide-react';
import { ModernSelect } from '../../shared/ModernSelect';

export function TipsTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Configuration */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Settings2 className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Tip Defaults</h3>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input type="checkbox" defaultChecked className="peer sr-only" />
                            <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-[#DDF853] peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                        </label>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="mb-3 block text-sm font-medium text-gray-400">
                                POS Tipping Screen
                            </label>
                            <div className="flex gap-4">
                                {[10, 15, 20].map(v => (
                                    <div key={v} className="flex flex-1 items-center gap-2">
                                        <input
                                            type="number"
                                            defaultValue={v}
                                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-3 text-center text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                        />
                                        <span className="text-xs font-bold text-gray-400">%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex h-[46px] items-center justify-between rounded-xl border border-gray-100 bg-gray-50/10 px-4">
                                <span className="text-sm font-semibold text-gray-900">
                                    Allow Custom Amount
                                </span>
                                <label className="relative inline-flex cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        defaultChecked
                                        className="peer sr-only"
                                    />
                                    <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-[#DDF853] peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">
                                Calculate Tips On
                            </label>
                            <ModernSelect
                                options={[
                                    { value: 'pre', label: 'Pre-tax Amount' },
                                    { value: 'post', label: 'Post-tax Amount' },
                                ]}
                            />
                        </div>
                    </div>
                </div>

                {/* Pool Rules */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Users className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Tip Pooling Rules</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">
                                Pooling Mode
                            </label>
                            <ModernSelect
                                options={[
                                    { value: 'none', label: 'No Pooling (Keep 100%)' },
                                    { value: 'full', label: 'Full Pool (Split evenly)' },
                                    { value: 'percent', label: 'Percentage Split' },
                                ]}
                                defaultValue="percent"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">
                                Pool Contribution
                            </label>
                            <div className="flex w-1/2 items-center gap-2">
                                <input
                                    type="number"
                                    defaultValue={20}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-3 text-center text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                />
                                <span className="text-xs font-bold text-gray-400">%</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="mb-1 block text-sm font-medium text-gray-400">
                                Pool Distribution (Eligible Jobs)
                            </label>
                            {['Line Cook', 'Dishwasher', 'Host', 'Runner'].map((job, i) => (
                                <label
                                    key={i}
                                    className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-gray-200 hover:bg-gray-50/50"
                                >
                                    <span className="text-sm font-semibold text-gray-900">
                                        {job}
                                    </span>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            defaultChecked={i < 2}
                                            className="peer sr-only"
                                        />
                                        <div className="h-5 w-5 rounded-md border-2 border-gray-300 bg-transparent transition-all peer-checked:border-[#DDF853] peer-checked:bg-[#DDF853]"></div>
                                        <svg
                                            className="pointer-events-none absolute top-1/2 left-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-black opacity-0 transition-opacity peer-checked:opacity-100"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={4}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M5 13l4 4L19 7"
                                            />
                                        </svg>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Claimed Tips */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Banknote className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Claimed Tips (Cash)</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="flex h-[46px] items-center justify-between rounded-xl border border-gray-100 bg-gray-50/10 px-4">
                            <span className="text-sm font-semibold text-gray-900">
                                Require cash tip disclosure at clock out
                            </span>
                            <label className="relative inline-flex cursor-pointer items-center">
                                <input type="checkbox" className="peer sr-only" />
                                <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-[#DDF853] peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                            </label>
                        </div>

                        <div className="w-1/2 space-y-2">
                            <label className="text-sm font-medium text-gray-400">
                                Minimum Claimed Amount (ETB)
                            </label>
                            <input
                                type="number"
                                defaultValue={0}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-3 text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
