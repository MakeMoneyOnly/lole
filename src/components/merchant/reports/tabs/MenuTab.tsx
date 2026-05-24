'use client';

import React from 'react';
import { Utensils, PieChart, ArrowUp, ArrowDown, Info } from 'lucide-react';
import { ModernSelect } from '../../shared/ModernSelect';

export function MenuTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Category Mix */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 lg:col-span-1">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <PieChart className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">Category Mix</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                        </div>
                    </div>

                    <div className="relative mb-8 flex aspect-square w-full items-center justify-center">
                        <div className="border-brand-accent/20 absolute inset-0 rounded-full border-[16px]"></div>
                        <div className="border-t-brand-accent border-r-brand-accent absolute inset-0 rotate-45 rounded-full border-[16px] border-transparent"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-3xl font-bold text-gray-900">65%</span>
                            <span className="text-xs font-bold text-gray-400">Food Revenue</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 font-semibold text-gray-900">
                                <div className="h-3 w-3 rounded-full bg-[#DDF853]"></div> Food
                            </div>
                            <span className="font-bold text-gray-500">65% • 80,925 ETB</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 font-semibold text-gray-900">
                                <div className="h-3 w-3 rounded-full bg-[#DDF853]/40"></div> Drinks
                            </div>
                            <span className="font-bold text-gray-500">25% • 31,125 ETB</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 font-semibold text-gray-900">
                                <div className="h-3 w-3 rounded-full bg-gray-100"></div> Desserts
                            </div>
                            <span className="font-bold text-gray-500">10% • 12,450 ETB</span>
                        </div>
                    </div>
                </div>

                {/* Item Performance */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 lg:col-span-2">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Utensils className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">
                                    Item Performance
                                </h3>
                                <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-gray-400">Sort by:</span>
                            <div className="w-32">
                                <ModernSelect
                                    options={[
                                        { value: 'revenue', label: 'Revenue' },
                                        { value: 'units', label: 'Units Sold' },
                                        { value: 'margin', label: 'Margin' },
                                    ]}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-400">
                                <tr>
                                    <th className="px-4 py-3">Item Name</th>
                                    <th className="px-4 py-3 text-right">Units Sold</th>
                                    <th className="px-4 py-3 text-right">Avg Price</th>
                                    <th className="px-4 py-3 text-right">Revenue (ETB)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm font-semibold text-gray-900">
                                {[
                                    {
                                        name: 'lole Special Platter',
                                        units: 145,
                                        price: '850',
                                        rev: '123,250',
                                        trend: 'up',
                                    },
                                    {
                                        name: 'Doro Wot',
                                        units: 210,
                                        price: '450',
                                        rev: '94,500',
                                        trend: 'up',
                                    },
                                    {
                                        name: 'St. George Beer',
                                        units: 450,
                                        price: '85',
                                        rev: '38,250',
                                        trend: 'up',
                                    },
                                    {
                                        name: 'Shiro Tegabino',
                                        units: 110,
                                        price: '180',
                                        rev: '19,800',
                                        trend: 'down',
                                    },
                                    {
                                        name: 'Avocado Juice',
                                        units: 45,
                                        price: '120',
                                        rev: '5,400',
                                        trend: 'down',
                                    },
                                ].map((item, i) => (
                                    <tr key={i}>
                                        <td className="px-4 py-4">{item.name}</td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {item.units}
                                                {item.trend === 'up' ? (
                                                    <ArrowUp className="h-3 w-3 text-green-500" />
                                                ) : (
                                                    <ArrowDown className="h-3 w-3 text-red-500" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">{item.price}</td>
                                        <td className="px-4 py-4 text-right font-bold text-black">
                                            {item.rev}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
