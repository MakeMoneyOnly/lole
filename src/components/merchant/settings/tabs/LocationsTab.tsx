'use client';

import React from 'react';
import { Plus, MapPin, Phone, Building, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LocationsTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Locations & Branches</h2>
                    <p className="text-sm text-gray-500">
                        Manage multi-unit operations and branch-specific configurations.
                    </p>
                </div>
                <button className="flex h-11 items-center gap-2 rounded-xl bg-black px-6 text-sm font-bold text-white transition-all hover:bg-gray-800 active:scale-95">
                    <Plus className="h-4 w-4" />
                    New Location
                </button>
            </div>

            {/* Locations Grid */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {[
                    {
                        name: 'Cafe Lucia - Bole Branch',
                        type: 'Main Branch',
                        subcity: 'Bole',
                        woreda: '03',
                        kebele: '04',
                        phone: '+251 911 123 456',
                        status: 'Operational',
                    },
                    {
                        name: 'Cafe Lucia - Yeka Kiosk',
                        type: 'Express Kiosk',
                        subcity: 'Yeka',
                        woreda: '05',
                        kebele: '12',
                        phone: '+251 911 654 321',
                        status: 'Closed',
                    },
                ].map((loc, i) => (
                    <div
                        key={i}
                        className="group hover: relative overflow-hidden rounded-3xl border border-gray-100 bg-white transition-all"
                    >
                        <div className="p-8">
                            <div className="mb-6 flex items-start justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-gray-900">
                                            {loc.name}
                                        </h3>
                                        <CheckCircle2
                                            className={cn(
                                                'h-4 w-4',
                                                loc.status === 'Operational'
                                                    ? 'text-green-500'
                                                    : 'text-gray-300'
                                            )}
                                        />
                                    </div>
                                    <span className="inline-block rounded-lg bg-gray-100 px-2 py-1 text-sm font-medium text-gray-500">
                                        {loc.type}
                                    </span>
                                </div>
                                <div className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        defaultChecked={loc.status === 'Operational'}
                                        className="peer sr-only"
                                    />
                                    <div className="h-full w-full rounded-full bg-gray-200 text-black transition-all peer-checked:bg-[#DDF853]" />
                                    <div className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-all peer-checked:translate-x-4" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 text-sm font-medium">
                                <div className="flex items-center gap-3 text-gray-500">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                        <MapPin className="h-4 w-4" />
                                    </div>
                                    <span>
                                        {loc.subcity}, Woreda {loc.woreda}, Kebele {loc.kebele} 🇪🇹
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-gray-500">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                        <Phone className="h-4 w-4" />
                                    </div>
                                    <span>{loc.phone}</span>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center gap-3 border-t border-gray-50 pt-6">
                                <button className="flex-1 rounded-xl bg-gray-50 py-2.5 text-xs font-bold text-gray-900 transition-all hover:bg-gray-100">
                                    Configure Hardware
                                </button>
                                <button className="flex-1 rounded-xl bg-gray-50 py-2.5 text-xs font-bold text-gray-900 transition-all hover:bg-gray-100">
                                    Branch Menu
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick Actions / Helpers */}
            <div className="rounded-3xl border border-gray-100 bg-gray-50/50 p-8">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                        <Building className="h-6 w-6" />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-gray-900">
                            Merchant Network Overview
                        </h4>
                        <p className="text-[11px] font-medium text-gray-500">
                            Shared tax and legal info from Business Info is applied across all 2
                            branches.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
