'use client';

import React from 'react';
import { Smartphone, Mail } from 'lucide-react';

export function NotificationsTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Notifications & Alerts</h2>
                    <p className="text-sm text-gray-500">
                        Configure SMS and email routing for operational alerts.
                    </p>
                </div>
            </div>

            {/* Alerts Configuration */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* SMS Configuration */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Smartphone className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">SMS Alerts 🇪🇹</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/30 px-5 py-4">
                            <div>
                                <p className="text-sm font-bold text-gray-900">Primary SMS Phone</p>
                                <p className="text-[11px] font-medium text-green-600">Verified</p>
                            </div>
                            <input
                                type="text"
                                className="h-10 w-40 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                defaultValue="+251 911 234 567"
                            />
                        </div>

                        {[
                            {
                                label: 'High-Value Orders',
                                desc: 'Alert for orders over 5,000 ETB',
                                checked: true,
                            },
                            {
                                label: 'Void & Comp Alerts',
                                desc: 'When staff void an item or apply discount',
                                checked: true,
                            },
                            {
                                label: 'Erca Offline Alert',
                                desc: 'If fiscal printer disconnects',
                                checked: true,
                            },
                        ].map((item, i) => (
                            <label
                                key={i}
                                className="flex cursor-pointer gap-4 rounded-xl border border-gray-50 bg-gray-50/30 p-4 transition-all hover:bg-gray-50"
                            >
                                <div className="relative mt-1 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        defaultChecked={item.checked}
                                        className="peer sr-only"
                                    />
                                    <div className="h-full w-full rounded-full bg-gray-200 text-black transition-all peer-checked:bg-[#DDF853]" />
                                    <div className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-all peer-checked:translate-x-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{item.label}</p>
                                    <p className="text-[11px] leading-tight font-medium text-gray-500">
                                        {item.desc}
                                    </p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Email Configuration */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Mail className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Email Reports</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/30 px-5 py-4">
                            <div>
                                <p className="text-sm font-bold text-gray-900">
                                    Daily Digest Email
                                </p>
                            </div>
                            <input
                                type="email"
                                className="h-10 w-48 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                defaultValue="admin@cafelucia.com"
                            />
                        </div>

                        {[
                            {
                                label: 'End of Day Report',
                                desc: 'Summary of sales, taxes, and labor',
                                checked: true,
                            },
                            {
                                label: 'Weekly Performance',
                                desc: 'Trends vs previous week',
                                checked: false,
                            },
                            {
                                label: 'Billing Invoices',
                                desc: 'Monthly subscription receipts',
                                checked: true,
                            },
                        ].map((item, i) => (
                            <label
                                key={i}
                                className="flex cursor-pointer gap-4 rounded-xl border border-gray-50 bg-gray-50/30 p-4 transition-all hover:bg-gray-50"
                            >
                                <div className="relative mt-1 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                                    <input
                                        type="checkbox"
                                        defaultChecked={item.checked}
                                        className="peer sr-only"
                                    />
                                    <div className="h-full w-full rounded-full bg-gray-200 text-black transition-all peer-checked:bg-[#DDF853]" />
                                    <div className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-all peer-checked:translate-x-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{item.label}</p>
                                    <p className="text-[11px] leading-tight font-medium text-gray-500">
                                        {item.desc}
                                    </p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
