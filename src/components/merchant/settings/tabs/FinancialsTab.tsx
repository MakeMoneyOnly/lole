'use client';

import React from 'react';
import { Landmark, Calculator, Calendar, ArrowUpRight, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernSelect } from '../../shared/ModernSelect';

export function FinancialsTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Financials & Taxes</h2>
                    <p className="text-sm text-gray-500">
                        Bank accounts, tax rates, and Ethiopian fiscal year configuration.
                    </p>
                </div>
            </div>

            {/* Tax Configuration Overview */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                {[
                    {
                        label: 'Vat Rate',
                        value: '15%',
                        sub: 'Mandatory',
                        icon: TrendingUp,
                        color: 'text-black',
                        bg: 'bg-[#DDF853] text-black',
                    },
                ].map((stat, i) => (
                    <div
                        key={i}
                        className="rounded-3xl border border-gray-100 bg-white p-5 transition-all"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <div
                                className={cn(
                                    'flex h-10 w-10 items-center justify-center rounded-xl',
                                    stat.bg
                                )}
                            >
                                <stat.icon className={cn('h-5 w-5', stat.color)} />
                            </div>
                            <button className="text-sm font-medium text-gray-400 hover:text-black">
                                Configure
                            </button>
                        </div>
                        <div className="space-y-1">
                            <span className="text-sm font-medium text-gray-400">{stat.label}</span>
                            <div className="flex flex-col">
                                <span className="text-2xl leading-none font-bold text-gray-900">
                                    {stat.value}
                                </span>
                                <span className="mt-1 text-xs font-medium text-gray-500">
                                    {stat.sub}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bank Accounts Section */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Landmark className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Settlement Accounts</h3>
                    </div>
                    <button className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white transition-all hover:bg-gray-800 active:scale-95">
                        Add Account
                    </button>
                </div>

                <div className="space-y-4">
                    {[
                        {
                            bank: 'Commercial Bank of Ethiopia (Cbe)',
                            account: '1000******1234',
                            type: 'Primary (Settlement)',
                            status: 'Verified',
                        },
                        {
                            bank: 'Awash International Bank',
                            account: '9984******5567',
                            type: 'Secondary (Backup)',
                            status: 'Pending',
                        },
                    ].map((acc, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/30 px-6 py-5 transition-all hover:bg-gray-50"
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#DDF853] text-black ring-1 ring-gray-100">
                                    <Landmark className="h-6 w-6 text-gray-400" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-bold text-gray-900">
                                            {acc.bank}
                                        </h4>
                                        <span
                                            className={cn(
                                                'rounded-full px-2 py-0.5 text-[9px] font-medium',
                                                i === 0
                                                    ? 'bg-green-50 text-green-600'
                                                    : 'bg-gray-100 text-gray-500'
                                            )}
                                        >
                                            {acc.status}
                                        </span>
                                    </div>
                                    <p className="text-xs font-medium text-gray-500">
                                        {acc.account} • {acc.type}
                                    </p>
                                </div>
                            </div>
                            <button className="rounded-lg p-2 text-gray-400 transition-all hover:bg-white hover:text-black">
                                <ArrowUpRight className="h-5 w-5" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Tax Compliance Details */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Fiscal Year & Prefs */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Calendar className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Reporting Calendar</h3>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">
                                Fiscal Year Calendar
                            </label>
                            <ModernSelect
                                options={[
                                    {
                                        value: 'eth_efy',
                                        label: 'Ethiopian Efy (Meskerem 1 – Pagume 5) 🇪🇹',
                                    },
                                    {
                                        value: 'gregorian',
                                        label: 'Gregorian (January 1 – December 31)',
                                    },
                                ]}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">
                                Income Tax Reporting Frequency
                            </label>
                            <div className="mt-2 flex gap-3">
                                {['Monthly', 'Quarterly', 'Annually'].map(mode => (
                                    <button
                                        key={mode}
                                        className={cn(
                                            'flex-1 rounded-xl border py-3 text-xs font-bold transition-all',
                                            mode === 'Annually'
                                                ? 'border-black bg-black text-white'
                                                : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
                                        )}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tax Toggles */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Calculator className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Tax Compliance Toggles</h3>
                    </div>
                    <div className="space-y-4">
                        {[
                            {
                                label: 'Mat (Minimum Alternative Tax) 🇪🇹',
                                desc: 'Apply 2.5% tax on turnover if higher than income tax.',
                                checked: true,
                            },
                            {
                                label: 'Withholding Tax (Wht) on Purchases',
                                desc: 'Automate 2% withholding on supplier payments.',
                                checked: false,
                            },
                            {
                                label: 'Poessa Automated deductions',
                                desc: 'Auto-calculate monthly pension contributions.',
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

            {/* ERCA & Payment Configurations */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* ERCA Fiscal Receipt Config */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Calculator className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Erca Fiscal Receipt</h3>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">
                                Fiscal Receipt Prefix
                            </label>
                            <input
                                type="text"
                                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                placeholder="e.g. FS"
                                defaultValue="AA-FS"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">
                                Next Receipt Series Number
                            </label>
                            <input
                                type="text"
                                className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                placeholder="000001"
                                defaultValue="014022"
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/30 px-5 py-4">
                            <div>
                                <p className="text-sm font-bold text-gray-900">
                                    Digital Signature Status
                                </p>
                                <p className="text-[11px] font-medium text-green-600">
                                    Active • MoR Verified
                                </p>
                            </div>
                            <button className="text-xs font-bold text-blue-600 hover:underline">
                                Renew
                            </button>
                        </div>
                    </div>
                </div>

                {/* Payments & Tips */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Landmark className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Payment Rules & Tips</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/30 px-5 py-4">
                            <div>
                                <p className="text-sm font-bold text-gray-900">Tip Options</p>
                                <p className="text-[11px] font-medium text-gray-500">
                                    Show suggested tips on payment screens
                                </p>
                            </div>
                            <ModernSelect
                                options={[
                                    { value: 'none', label: 'No Tip Prompt' },
                                    { value: 'flat', label: 'Flat Amounts (10, 20, 50)' },
                                    { value: 'percentage', label: 'Percentage (5%, 10%, 15%)' },
                                ]}
                            />
                        </div>

                        {[
                            {
                                label: 'Split Payments',
                                desc: 'Allow customers to split bill by items or amount.',
                                checked: true,
                            },
                            {
                                label: 'Surcharge Disclosure',
                                desc: 'Print NBE-mandated card surcharge warning.',
                                checked: true,
                            },
                            {
                                label: 'Cash Discount Program',
                                desc: 'Apply automatic discount for cash payments.',
                                checked: false,
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
