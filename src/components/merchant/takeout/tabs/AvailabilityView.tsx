'use client';

import React from 'react';
import { MapPin, CheckCircle2, Zap, PauseCircle, Clock, Truck } from 'lucide-react';
import { ModernSelect } from '../../shared/ModernSelect';
import { DeliveryZoneBuilder } from '../DeliveryZoneBuilder';

export function AvailabilityView(): React.JSX.Element {
    return (
        <div className="space-y-8 pb-12">
            {/* 1. Core Service Toggles & Mapping */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">POS Channel Mapping</h3>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-4">
                            <span className="text-sm font-bold text-gray-700">Online Takeout</span>
                            <div className="w-48">
                                <ModernSelect
                                    value="1"
                                    onChange={() => {}}
                                    options={[
                                        { value: '1', label: 'Takeout' },
                                        { value: '2', label: 'Quick Service' },
                                    ]}
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-gray-50 p-4">
                            <span className="text-sm font-bold text-gray-700">Online Delivery</span>
                            <div className="w-48">
                                <ModernSelect
                                    value="1"
                                    onChange={() => {}}
                                    options={[
                                        { value: '1', label: 'Delivery' },
                                        { value: '2', label: 'External Delivery' },
                                    ]}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Approval Mode</h3>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <button className="border-brand-accent bg-brand-accent/5 flex flex-col gap-2 rounded-2xl border-2 p-4 text-left outline-none">
                            <Zap className="text-brand-accent h-4 w-4" />
                            <span className="text-sm font-bold text-gray-900">Automatic</span>
                        </button>
                        <button className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 text-left outline-none hover:border-gray-200">
                            <PauseCircle className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-bold text-gray-900">Manual</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Scheduling & Lead Times */}
            <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                        <Clock className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Scheduling & Lead Times</h3>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-gray-900">
                                Future Ordering
                            </label>
                            <div className="bg-brand-accent relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors">
                                <div className="absolute right-1 h-3 w-3 translate-x-0 rounded-full bg-white transition-all" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500">
                                Max Days in Advance
                            </label>
                            <input
                                type="number"
                                defaultValue="7"
                                className="focus:ring-brand-accent w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2.5 text-sm font-bold text-gray-900 outline-none focus:ring-2"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-sm font-bold text-gray-900">
                            Min Lead Time (Takeout)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">
                                    Hours
                                </span>
                                <input
                                    type="number"
                                    defaultValue="0"
                                    className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-900 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">
                                    Minutes
                                </span>
                                <input
                                    type="number"
                                    defaultValue="20"
                                    className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-900 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-sm font-bold text-gray-900">
                            Min Lead Time (Delivery)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">
                                    Hours
                                </span>
                                <input
                                    type="number"
                                    defaultValue="0"
                                    className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-900 outline-none"
                                />
                            </div>
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">
                                    Minutes
                                </span>
                                <input
                                    type="number"
                                    defaultValue="45"
                                    className="w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-900 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. Delivery Settings */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                                <Truck className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Delivery Logic</h3>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-600">
                                Billing Address Requirement
                            </label>
                            <ModernSelect
                                value="2"
                                onChange={() => {}}
                                options={[
                                    { value: '1', label: 'Must match delivery info' },
                                    { value: '2', label: 'Prompt After Delivery Info' },
                                ]}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600">
                                    Delivery Fee (ETB)
                                </label>
                                <input
                                    type="text"
                                    className="focus:ring-brand-accent w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:ring-2"
                                    defaultValue="100"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-600">
                                    Min Order Value
                                </label>
                                <input
                                    type="text"
                                    className="focus:ring-brand-accent w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:ring-2"
                                    defaultValue="500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <DeliveryZoneBuilder />
            </div>
        </div>
    );
}
