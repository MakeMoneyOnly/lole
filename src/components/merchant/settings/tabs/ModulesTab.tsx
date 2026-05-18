'use client';

import React from 'react';
import { CheckCircle, Info, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const MODULES = [
    {
        id: 'reports',
        label: 'Reports',
        status: 'Core',
        enabled: true,
        locked: true,
        description: 'Sales, labor, and tax analytics.',
    },
    {
        id: 'employees',
        label: 'Employees',
        status: 'Core',
        enabled: true,
        locked: true,
        description: 'Staff management and permissions.',
    },
    {
        id: 'payroll',
        label: 'Payroll 🇪🇹',
        status: 'Add-on',
        enabled: false,
        locked: false,
        description: 'Ethiopian-compliant PAYE & pension filing.',
    },
    {
        id: 'takeout',
        label: 'Takeout & Delivery',
        status: 'Add-on',
        enabled: true,
        locked: false,
        description: 'Online ordering and partner hub.',
    },
    {
        id: 'payments',
        label: 'Payments',
        status: 'Core',
        enabled: true,
        locked: true,
        description: 'Telebirr, Cbe, and Card processing.',
    },
    {
        id: 'marketing',
        label: 'Marketing / Loyalty',
        status: 'Add-on',
        enabled: true,
        locked: false,
        description: 'SMS campaigns and loyalty program.',
    },
    {
        id: 'foh',
        label: 'Front of House',
        status: 'Add-on',
        enabled: false,
        locked: false,
        description: 'Floor plans and guest management.',
    },
    {
        id: 'kitchen',
        label: 'Kitchen / Kds',
        status: 'Add-on',
        enabled: true,
        locked: false,
        description: 'Prep station routing and Kds screens.',
    },
    {
        id: 'financial',
        label: 'Financial Products',
        status: 'Waitlist',
        enabled: false,
        locked: false,
        description: 'Working capital and merchant loans.',
    },
    {
        id: 'integrations',
        label: 'Integrations',
        status: 'Core',
        enabled: true,
        locked: true,
        description: '3rd-party marketplace apps.',
    },
    {
        id: 'shop',
        label: 'Hardware Shop',
        status: 'Beta',
        enabled: false,
        locked: false,
        description: 'Purchase Pos hardware directly.',
    },
];

export function ModulesTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Feature Modules</h2>
                    <p className="text-sm text-gray-500">
                        Enable or disable core platform capabilities as your business grows.
                    </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[#DDF853]/20 bg-[#DDF853] px-3 py-1 text-[11px] font-bold text-black">
                    <Star className="h-3 w-3 fill-black" />
                    Premium Plan
                </div>
            </div>

            {/* Billing & Subscription */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Star className="h-5 w-5 fill-black" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Current Plan</h3>
                            <p className="text-[11px] font-medium text-gray-500">
                                Billed monthly • Next invoice on May 1st
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-900 transition-all hover:bg-gray-50">
                            View Invoices
                        </button>
                        <button className="rounded-xl bg-black px-4 py-2 text-xs font-bold text-white transition-all hover:bg-gray-800">
                            Manage Plan
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="rounded-xl border border-gray-50 bg-gray-50/30 p-4">
                        <p className="text-[11px] font-medium text-gray-400">Plan</p>
                        <p className="mt-1 text-base font-bold text-gray-900">Premium Tier</p>
                        <p className="mt-2 text-[10px] font-medium text-gray-500">
                            Includes core modules + 3 add-ons
                        </p>
                    </div>
                    <div className="rounded-xl border border-gray-50 bg-gray-50/30 p-4">
                        <p className="text-[11px] font-medium text-gray-400">Price</p>
                        <div className="mt-1 flex items-baseline gap-1">
                            <p className="text-lg font-bold text-gray-900">1,500 ETB</p>
                            <p className="text-[10px] font-medium text-gray-500">/ month</p>
                        </div>
                    </div>
                    <div className="rounded-xl border border-gray-50 bg-gray-50/30 p-4">
                        <p className="text-[11px] font-medium text-gray-400">Payment Method</p>
                        <p className="mt-1 text-sm font-bold text-gray-900">Telebirr Auto-Pay</p>
                        <p className="mt-2 text-[10px] font-medium text-green-600">Active</p>
                    </div>
                </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {MODULES.map((module, i) => (
                    <div
                        key={i}
                        className={cn(
                            'group hover: relative flex flex-col justify-between rounded-3xl border border-gray-100 bg-white p-6 transition-all',
                            module.locked ? 'border-gray-50 opacity-90' : 'border-gray-100'
                        )}
                    >
                        <div className="mb-8 space-y-4">
                            <div className="flex items-center justify-between">
                                <span
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-[9px] font-medium',
                                        module.status === 'Core'
                                            ? 'bg-gray-100 text-gray-900'
                                            : module.status === 'Add-on'
                                              ? 'bg-blue-50 text-blue-600'
                                              : 'bg-amber-50 text-amber-600'
                                    )}
                                >
                                    {module.status}
                                </span>
                                {!module.locked && (
                                    <div className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            defaultChecked={module.enabled}
                                            className="peer sr-only"
                                        />
                                        <div className="h-full w-full rounded-full bg-gray-200 text-black transition-all peer-checked:bg-[#DDF853]" />
                                        <div className="absolute left-0.5 h-4 w-4 rounded-full bg-white transition-all peer-checked:translate-x-4" />
                                    </div>
                                )}
                                {module.locked && (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-sm leading-none font-bold text-gray-900">
                                    {module.label}
                                </h4>
                                <p className="text-[11px] leading-tight font-medium text-gray-500">
                                    {module.description}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 border-t border-gray-50 pt-4">
                            <button className="text-[10px] font-bold text-blue-600 transition-colors hover:text-blue-700">
                                Learn More
                            </button>
                            <Info className="h-3 w-3 text-gray-300" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Help Note */}
            <div className="rounded-3xl border-b border-dashed border-gray-100 bg-gray-50/30 p-8 text-center">
                <p className="mx-auto max-w-md text-xs font-medium text-gray-500">
                    Disabling a module will remove its corresponding tab from the sidebar for all
                    staff users. Core modules cannot be disabled.
                </p>
            </div>
        </div>
    );
}
