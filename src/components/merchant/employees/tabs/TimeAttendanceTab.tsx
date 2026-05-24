'use client';

import React from 'react';
import { Clock, Settings2, AlertTriangle } from 'lucide-react';
import { ModernSelect } from '../../shared/ModernSelect';

export function TimeAttendanceTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Clock-In Records & Timesheets */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 lg:col-span-2">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Clock className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Timesheets</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    className="rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                />
                            </div>
                            <div className="w-40">
                                <ModernSelect
                                    options={[
                                        { value: 'all', label: 'All Employees' },
                                        { value: 'almaz', label: 'Almaz T.' },
                                    ]}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase">
                                <tr>
                                    <th className="px-4 py-3">Employee</th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="bg-gray-100/50 px-4 py-3">Clock In</th>
                                    <th className="bg-gray-100/50 px-4 py-3">Clock Out</th>
                                    <th className="px-4 py-3">Break</th>
                                    <th className="border-l border-gray-100 px-4 py-3 text-right">
                                        Net Hours
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm font-semibold text-gray-900">
                                {[
                                    {
                                        emp: 'Almaz T.',
                                        date: 'Apr 18, 2026',
                                        in: '08:00',
                                        out: '16:30',
                                        brk: '30m',
                                        net: '8h 0m',
                                    },
                                    {
                                        emp: 'Dawit M.',
                                        date: 'Apr 18, 2026',
                                        in: '07:30',
                                        out: '15:30',
                                        brk: '0m',
                                        net: '8h 0m',
                                    },
                                ].map((row, i) => (
                                    <tr key={i} className="hover:bg-gray-50/30">
                                        <td className="px-4 py-4">{row.emp}</td>
                                        <td className="px-4 py-4 text-gray-500">{row.date}</td>
                                        <td className="bg-gray-50/30 px-4 py-4">
                                            <input
                                                type="time"
                                                defaultValue={row.in}
                                                className="w-24 rounded-lg border border-transparent bg-transparent py-1 text-sm font-bold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:bg-white focus:ring-1 focus:ring-[#DDF853]"
                                            />
                                        </td>
                                        <td className="bg-gray-50/30 px-4 py-4">
                                            <input
                                                type="time"
                                                defaultValue={row.out}
                                                className="w-24 rounded-lg border border-transparent bg-transparent py-1 text-sm font-bold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:bg-white focus:ring-1 focus:ring-[#DDF853]"
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-gray-500">{row.brk}</td>
                                        <td className="border-l border-gray-100 px-4 py-4 text-right font-bold text-black">
                                            {row.net}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Configurations Sidebar */}
                <div className="space-y-8 lg:col-span-1">
                    {/* Overtime Rules 🇪🇹 */}
                    <div className="rounded-3xl border border-gray-100 bg-white p-8">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Overtime Rules 🇪🇹</h3>
                        </div>

                        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                            <p className="text-[11px] leading-relaxed font-semibold text-blue-800">
                                configured per Ethiopian Labour Proclamation No. 1156/2019 standards
                                for standard work weeks.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500">
                                    Daily Threshold
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        defaultValue={8}
                                        className="w-16 rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-2 text-center text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    />
                                    <span className="text-xs font-bold text-gray-400">Hours</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500">
                                    Weekly Threshold
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        defaultValue={48}
                                        className="w-16 rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-2 text-center text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    />
                                    <span className="text-xs font-bold text-gray-400">Hours</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500">
                                    Overtime Rate
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.25"
                                        defaultValue={1.25}
                                        className="w-16 rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-2 text-center text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    />
                                    <span className="text-xs font-bold text-gray-400">x</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500">
                                    Holiday Rate
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.25"
                                        defaultValue={2.0}
                                        className="w-16 rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-2 text-center text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    />
                                    <span className="text-xs font-bold text-gray-400">x</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Break Configuration */}
                    <div className="rounded-3xl border border-gray-100 bg-white p-8">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Settings2 className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Break Config</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500">
                                    Paid Break
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        defaultValue={0}
                                        className="w-16 rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-2 text-center text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    />
                                    <span className="text-xs font-bold text-gray-400">Mins</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-500">
                                    Unpaid Break
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        defaultValue={30}
                                        className="w-16 rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-2 text-center text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    />
                                    <span className="text-xs font-bold text-gray-400">Mins</span>
                                </div>
                            </div>
                            <div className="my-2 border-t border-gray-100"></div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-gray-900">
                                    Require break after
                                </span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        defaultValue={4}
                                        className="w-16 rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-2 text-center text-sm font-bold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    />
                                    <span className="text-xs font-bold text-gray-400">Hours</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
