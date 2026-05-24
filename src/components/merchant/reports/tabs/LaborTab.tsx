'use client';

import React from 'react';
import {
    Clock,
    AlertTriangle,
    Banknote,
    Download,
    ListFilter,
    Info,
    ArrowRight,
} from 'lucide-react';
import { ModernSelect } from '../../shared/ModernSelect';

export function LaborTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            {/* Labor Summary */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900">Labor Summary</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {[
                        [
                            {
                                label: 'Total Hours Worked',
                                value: '342.5',
                                change: '+2.4%',
                                isUp: true,
                                type: 'bar1',
                            },
                            {
                                label: 'Total Labor Cost',
                                value: '18,500',
                                isCurrency: true,
                                change: '-1.2%',
                                isUp: false,
                                type: 'bar2',
                            },
                        ],
                        [
                            {
                                label: 'Labor Cost % of Sales',
                                value: '14.8%',
                                change: '+0.5%',
                                isUp: true,
                                type: 'circle1',
                            },
                            {
                                label: 'Overtime Hours',
                                value: '12.5',
                                change: '-5.0%',
                                isUp: false,
                                type: 'circle1',
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
                                                        {metric.isCurrency && (
                                                            <span className="text-3xl font-normal text-gray-400">
                                                                Br.
                                                            </span>
                                                        )}
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
                                                {metric.type === 'circle1' && (
                                                    <div className="relative h-10 w-10 rounded-full">
                                                        <div className="border-brand-accent absolute top-0 left-0 h-10 w-10 rounded-full border-4 border-t-transparent border-r-transparent"></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex border-t border-gray-100">
                                <button className="group flex flex-1 items-center justify-center gap-2 rounded-bl-3xl border-r border-gray-100 bg-gray-50 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-100">
                                    See details{' '}
                                    <ArrowRight
                                        strokeWidth={2}
                                        className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-rotate-12"
                                    />
                                </button>
                                <button className="group flex flex-1 items-center justify-center gap-2 rounded-br-3xl bg-gray-50 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-100">
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

            {/* Time Entries Table */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <ListFilter className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">Time Entries</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors hover:text-gray-900" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <button className="flex h-11 w-32 items-center gap-2 rounded-xl bg-gray-50/30 px-4 py-2.5 text-sm font-bold text-gray-900 transition-all focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]">
                                <span className="font-medium text-gray-400">Date...</span>
                            </button>
                        </div>
                        <div className="w-48">
                            <ModernSelect
                                options={[
                                    { value: 'all', label: 'All Employees' },
                                    { value: 'almaz', label: 'Almaz T.' },
                                    { value: 'dawit', label: 'Dawit M.' },
                                ]}
                            />
                        </div>
                        <button className="flex h-11 items-center gap-2 rounded-xl bg-[#DDF853] px-6 text-sm font-bold text-black transition-all active:scale-[0.98]">
                            <Download className="h-4 w-4" strokeWidth={2.5} />
                            Export
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-gray-50/30">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50 text-xs font-bold text-gray-400">
                            <tr>
                                <th className="px-4 py-3">Employee</th>
                                <th className="px-4 py-3">Job</th>
                                <th className="px-4 py-3">Clock In</th>
                                <th className="px-4 py-3">Clock Out</th>
                                <th className="px-4 py-3">Hours</th>
                                <th className="px-4 py-3">Wage (ETB)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-900">
                            {[
                                {
                                    emp: 'Almaz T.',
                                    job: 'Server',
                                    in: '08:00 AM',
                                    out: '04:30 PM',
                                    hrs: '8.5',
                                    wage: '425.00',
                                },
                                {
                                    emp: 'Dawit M.',
                                    job: 'Line Cook',
                                    in: '07:30 AM',
                                    out: '03:30 PM',
                                    hrs: '8.0',
                                    wage: '600.00',
                                },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-gray-100/30">
                                    <td className="px-4 py-3">{row.emp}</td>
                                    <td className="px-4 py-3">{row.job}</td>
                                    <td className="px-4 py-3">{row.in}</td>
                                    <td className="px-4 py-3">{row.out}</td>
                                    <td className="px-4 py-3">{row.hrs}</td>
                                    <td className="px-4 py-3">{row.wage}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Overtime Alerts */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-500">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">Overtime Alerts</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors hover:text-gray-900" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-xl bg-red-50/30 p-4 font-semibold">
                            <div>
                                <p className="text-sm text-gray-900">Dawit M.</p>
                                <p className="text-xs text-red-500">Approaching 48h limit</p>
                            </div>
                            <span className="text-sm font-bold text-gray-900">46.5 hours</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/30 p-4 font-semibold">
                            <div>
                                <p className="text-sm text-gray-900">Almaz T.</p>
                                <p className="text-xs text-gray-400">Normal</p>
                            </div>
                            <span className="text-sm font-bold text-gray-900">38.0 hours</span>
                        </div>
                    </div>
                </div>

                {/* Tip Summary */}
                <div className="flex min-h-[280px] flex-col rounded-3xl border border-gray-100 bg-white shadow-none">
                    <div className="flex-1 p-8">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Banknote className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">Tip Summary</h3>
                                <div className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200">
                                    <Info className="h-2.5 w-2.5 text-gray-400" />
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-sm font-medium text-gray-400">
                                Total Tips Collected
                            </p>
                            <p className="mt-1 text-4xl font-bold text-black">
                                4,250 <span className="text-xl font-normal text-gray-400">ETB</span>
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-xl bg-gray-50/30 p-3">
                                <span className="text-sm font-semibold text-gray-900">
                                    Almaz T.
                                </span>
                                <span className="text-sm font-bold text-gray-500">1,200 ETB</span>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-gray-50/30 p-3">
                                <span className="text-sm font-semibold text-gray-900">
                                    Tip Pool (BOH)
                                </span>
                                <span className="text-sm font-bold text-gray-500">800 ETB</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex border-t border-gray-100">
                        <button className="group flex flex-1 items-center justify-center gap-2 rounded-b-3xl bg-gray-50 py-4 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-100">
                            See details{' '}
                            <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
