'use client';

import React from 'react';
import { Download, ListFilter, PieChart, Info, ArrowRight } from 'lucide-react';
import { ModernSelect } from '../../shared/ModernSelect';

export function PaymentsTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            {/* Payment Method Breakdown */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <PieChart className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900">Payment Breakdown</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                        </div>
                    </div>
                    <div className="w-32">
                        <ModernSelect
                            options={[
                                { value: 'today', label: 'Today' },
                                { value: 'week', label: 'This Week' },
                                { value: 'month', label: 'This Month' },
                            ]}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {[
                        [
                            {
                                label: 'Cash',
                                value: '14,650',
                                isCurrency: true,
                                change: '124 trans.',
                                isUp: true,
                                type: 'bar1',
                            },
                            {
                                label: 'Telebirr',
                                value: '22,400',
                                isCurrency: true,
                                change: '86 trans.',
                                isUp: true,
                                type: 'bar2',
                            },
                        ],
                        [
                            {
                                label: 'CBE Birr',
                                value: '18,200',
                                isCurrency: true,
                                change: '65 trans.',
                                isUp: true,
                                type: 'circle1',
                            },
                            {
                                label: 'Card Payment',
                                value: '5,000',
                                isCurrency: true,
                                change: '12 trans.',
                                isUp: true,
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
                                                        <span className="flex items-center gap-0.5 rounded-lg bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600">
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
                                                    <div className="border-brand-accent/10 relative h-10 w-10 rounded-full border-4">
                                                        <div className="border-brand-accent absolute top-[-4px] left-[-4px] h-10 w-10 rounded-full border-4 border-t-transparent border-r-transparent"></div>
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

            {/* Transaction Detail */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <ListFilter className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">Transaction Detail</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-48">
                            <ModernSelect
                                options={[
                                    { value: 'all', label: 'All Methods' },
                                    { value: 'cash', label: 'Cash' },
                                    { value: 'telebirr', label: 'Telebirr' },
                                    { value: 'cbe', label: 'CBE Birr' },
                                ]}
                            />
                        </div>
                        <button className="flex h-11 items-center gap-2 rounded-xl bg-[#DDF853] px-6 text-sm font-bold text-black transition-all active:scale-[0.98]">
                            <Download className="h-4 w-4" strokeWidth={2.5} />
                            Export
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-400">
                            <tr>
                                <th className="px-4 py-3">Date & Time</th>
                                <th className="px-4 py-3">Order #</th>
                                <th className="px-4 py-3">Method</th>
                                <th className="px-4 py-3">Amount (ETB)</th>
                                <th className="px-4 py-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm font-semibold text-gray-900">
                            {[
                                {
                                    date: '24 Apr, 14:32',
                                    order: '#10045',
                                    method: 'Telebirr',
                                    amount: '850.00',
                                    status: 'Success',
                                    statusColor: 'bg-green-50 text-green-600',
                                },
                                {
                                    date: '24 Apr, 14:28',
                                    order: '#10044',
                                    method: 'Cash',
                                    amount: '320.00',
                                    status: 'Success',
                                    statusColor: 'bg-green-50 text-green-600',
                                },
                                {
                                    date: '24 Apr, 14:15',
                                    order: '#10043',
                                    method: 'CBE Birr',
                                    amount: '1,200.00',
                                    status: 'Failed',
                                    statusColor: 'bg-red-50 text-red-600',
                                },
                                {
                                    date: '24 Apr, 13:50',
                                    order: '#10042',
                                    method: 'Telebirr',
                                    amount: '450.00',
                                    status: 'Refunded',
                                    statusColor: 'bg-yellow-50 text-yellow-600',
                                },
                            ].map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50/30">
                                    <td className="px-4 py-3 text-gray-500">{row.date}</td>
                                    <td className="px-4 py-3">{row.order}</td>
                                    <td className="px-4 py-3">{row.method}</td>
                                    <td className="px-4 py-3">{row.amount}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span
                                            className={`inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-bold ${row.statusColor}`}
                                        >
                                            {row.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
