'use client';

import React, { useState } from 'react';
import {
    QrCode,
    Layout,
    Monitor,
    Smartphone,
    Landmark,
    MessageSquare,
    Plus,
    Search,
    MoreHorizontal,
    Save,
    Info,
    ArrowUpRight,
    Users,
    Clock,
    BadgeCheck,
    Download,
    Printer,
    PenTool,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernSelect } from '../shared/ModernSelect';

// ─────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────

const TABS = [
    { id: 'dashboard', label: 'Overview', icon: Layout },
    { id: 'floorplan', label: 'Floor Plan', icon: PenTool },
    { id: 'orderscreen', label: 'Order Screen', icon: Monitor },
    { id: 'mobile', label: 'Mobile Dining', icon: Smartphone },
    { id: 'revenue', label: 'Revenue Centers', icon: Landmark },
    { id: 'messaging', label: 'Staff Messaging', icon: MessageSquare },
];

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export function FOHPageClient(): React.JSX.Element {
    const [activeTab, setActiveTab] = useState('dashboard');
    const qrActive = true;

    return (
        <div className="font-inter flex min-h-screen flex-col bg-white px-10 py-4 tracking-[-0.04em]">
            {/* 1. Header Section */}
            <div className="mb-2 flex items-center justify-between py-6">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 pr-10">
                        <div className="relative h-14 w-14 overflow-hidden rounded-full ring-2 ring-white ring-offset-2">
                            <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-[#DDF853] text-black">
                                <QrCode className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-xl leading-none font-bold text-gray-900">
                                Front of House
                            </h1>
                            <div className="flex w-fit items-center gap-1.5 py-1 text-[10px] font-bold text-gray-500">
                                <div
                                    className={cn(
                                        'h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(221,248,83,0.8)]',
                                        qrActive ? 'bg-[#DDF853]' : 'bg-red-500 shadow-red-500/50'
                                    )}
                                />
                                {qrActive ? 'QR Ordering: Active' : 'QR Ordering: Disabled'}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-0">
                        <div className="flex flex-col gap-1 pr-10">
                            <span className="text-[11px] font-medium tracking-wider text-gray-400 uppercase">
                                Active Tables
                            </span>
                            <span className="text-sm leading-none font-bold text-gray-900">
                                18 / 24
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 border-l border-gray-200 pr-10 pl-10">
                            <span className="text-[11px] font-medium tracking-wider text-gray-400 uppercase">
                                QR Usage
                            </span>
                            <span className="text-sm leading-none font-bold text-gray-900">
                                65% today
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition-all outline-none hover:bg-gray-50 active:scale-95">
                        <Printer className="h-4 w-4" />
                        Print QR Sheets
                    </button>
                    <button className="bg-brand-accent shadow-brand-accent/10 flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold text-black transition-all outline-none hover:brightness-105 active:scale-95">
                        <Save className="h-4 w-4" />
                        Save changes
                    </button>
                </div>
            </div>

            {/* 2. Navigation Tabs */}
            <div className="no-scrollbar mb-6 flex items-center gap-2 overflow-x-auto border-b border-gray-200">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'group relative flex items-center gap-2.5 px-4 py-4 text-sm font-medium whitespace-nowrap transition-all outline-none',
                            activeTab === tab.id
                                ? 'font-bold text-black after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-black'
                                : 'font-medium text-gray-400 hover:text-gray-600'
                        )}
                    >
                        <tab.icon
                            className={cn(
                                'h-4 w-4',
                                activeTab === tab.id
                                    ? 'text-black'
                                    : 'text-gray-400 group-hover:text-gray-600'
                            )}
                        />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 3. Content Area */}
            <div className="w-full pb-20">
                {activeTab === 'dashboard' && <FOHDashboardView />}
                {activeTab === 'floorplan' && <FloorPlanView />}
                {activeTab === 'orderscreen' && <OrderScreenView />}
                {activeTab === 'mobile' && <MobileDiningView />}
                {activeTab === 'revenue' && <RevenueCentersView />}
                {activeTab === 'messaging' && <MessagingView />}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// View Components
// ─────────────────────────────────────────────

function FOHDashboardView(): React.JSX.Element {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* Tables Metric Card */}
                <div className="col-span-1 flex flex-col rounded-3xl border border-gray-100 bg-white lg:col-span-6">
                    <div className="flex flex-1">
                        <div className="flex flex-1 flex-col border-r border-gray-50 p-6">
                            <div>
                                <div className="-mt-2.5 mb-0 flex h-11 items-center gap-2">
                                    <h3 className="text-base font-medium text-gray-400">
                                        Active Tables
                                    </h3>
                                    <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                                </div>
                                <div className="flex items-end justify-between">
                                    <div className="flex flex-col gap-2">
                                        <div className="-mt-2 flex items-baseline gap-1.5">
                                            <span className="text-3xl font-bold text-black">
                                                18
                                            </span>
                                            <span className="text-xl font-medium text-gray-400">
                                                / 24
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                                            75% occupancy
                                            <span className="flex items-center gap-0.5 rounded-lg bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
                                                Normal
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex h-10 items-end gap-1.5">
                                        <div className="bg-brand-accent/30 h-4 w-2 rounded-t-sm"></div>
                                        <div className="bg-brand-accent h-9 w-2 rounded-t-sm"></div>
                                        <div className="bg-brand-accent h-7 w-2 rounded-t-sm"></div>
                                        <div className="bg-brand-accent/30 h-5 w-2 rounded-t-sm"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-1 flex-col p-6">
                            <div>
                                <div className="-mt-2.5 mb-0 flex h-11 items-center gap-2">
                                    <h3 className="text-base font-medium text-gray-400">
                                        Guest Count
                                    </h3>
                                    <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                                </div>
                                <div className="flex items-end justify-between">
                                    <div className="flex flex-col gap-2">
                                        <div className="-mt-2 flex items-baseline gap-1.5">
                                            <span className="text-3xl font-bold text-black">
                                                64
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                                            vs last hour
                                            <span className="flex items-center gap-0.5 rounded-lg bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
                                                +12
                                            </span>
                                        </div>
                                    </div>
                                    <Users className="h-10 w-10 text-gray-100" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex border-t border-gray-50">
                        <button className="group flex flex-1 items-center justify-center gap-2 rounded-bl-3xl border-r border-gray-50 bg-gray-50 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-100">
                            View Live Map <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                        <button className="group flex flex-1 items-center justify-center gap-2 rounded-br-3xl bg-gray-50 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-100">
                            Staff Rotation <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>

                {/* QR Performance Card */}
                <div className="col-span-1 flex flex-col rounded-3xl border border-gray-100 bg-white lg:col-span-6">
                    <div className="flex flex-1">
                        <div className="flex flex-1 flex-col border-r border-gray-50 p-6">
                            <div>
                                <div className="-mt-2.5 mb-0 flex h-11 items-center gap-2">
                                    <h3 className="text-base font-medium text-gray-400">
                                        QR Sales
                                    </h3>
                                    <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                                </div>
                                <div className="flex items-end justify-between">
                                    <div className="flex flex-col gap-2">
                                        <div className="-mt-2 flex items-baseline gap-1.5">
                                            <span className="text-3xl font-normal text-gray-400">
                                                Br.
                                            </span>
                                            <span className="text-3xl font-bold text-black">
                                                12,400
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                                            QR Contribution
                                            <span className="flex items-center gap-0.5 rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                                                42%
                                            </span>
                                        </div>
                                    </div>
                                    <QrCode className="h-10 w-10 text-gray-100" />
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-1 flex-col p-6">
                            <div>
                                <div className="-mt-2.5 mb-0 flex h-11 items-center gap-2">
                                    <h3 className="text-base font-medium text-gray-400">
                                        Avg Session
                                    </h3>
                                    <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                                </div>
                                <div className="flex items-end justify-between">
                                    <div className="flex flex-col gap-2">
                                        <div className="-mt-2 flex items-baseline gap-1.5">
                                            <span className="text-3xl font-bold text-black">
                                                48
                                            </span>
                                            <span className="ml-1 text-xl font-medium text-gray-400">
                                                min
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                                            -5m vs legacy
                                        </div>
                                    </div>
                                    <Clock className="h-10 w-10 text-gray-100" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex border-t border-gray-50">
                        <button className="group flex flex-1 items-center justify-center gap-2 rounded-bl-3xl border-r border-gray-50 bg-gray-50 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-100">
                            QR Analytics <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                        <button className="group flex flex-1 items-center justify-center gap-2 rounded-br-3xl bg-gray-50 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-100">
                            Waitlist Settings <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Quick Sections List */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="col-span-1 overflow-hidden rounded-3xl border border-gray-100 bg-white lg:col-span-12">
                    <div className="flex items-center justify-between border-b border-gray-50 px-8 py-6">
                        <h3 className="text-base font-bold text-gray-900">
                            Current Section Status
                        </h3>
                        <div className="flex gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-600">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                                Main Dining Open
                            </span>
                        </div>
                    </div>
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-4 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                    Section
                                </th>
                                <th className="px-8 py-4 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                    Assigned Staff
                                </th>
                                <th className="px-8 py-4 text-right text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                    Tables Occupied
                                </th>
                                <th className="px-8 py-4 text-right text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {[
                                {
                                    name: 'Main Hall',
                                    staff: 'Henok T., Sara S.',
                                    occupied: '12 / 14',
                                    trend: 'High',
                                },
                                {
                                    name: 'Terrace (Addis View)',
                                    staff: 'Dawit A.',
                                    occupied: '6 / 10',
                                    trend: 'Medium',
                                },
                                {
                                    name: 'Bar Counter',
                                    staff: 'Betty L.',
                                    occupied: '0 / 8',
                                    trend: 'Low',
                                },
                            ].map((item, idx) => (
                                <tr
                                    key={idx}
                                    className="group transition-colors hover:bg-gray-50/80"
                                >
                                    <td className="px-8 py-4">
                                        <p className="text-sm font-bold text-gray-900">
                                            {item.name}
                                        </p>
                                    </td>
                                    <td className="px-8 py-4 text-sm font-medium text-gray-600">
                                        {item.staff}
                                    </td>
                                    <td className="px-8 py-4 text-right text-sm font-bold text-gray-900">
                                        {item.occupied}
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <button className="text-xs font-bold text-blue-600 hover:underline">
                                            Reassign
                                        </button>
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

function FloorPlanView(): React.JSX.Element {
    return (
        <div className="space-y-8 pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Floor Plan Builder</h2>
                    <p className="text-sm text-gray-500">
                        Design your restaurant layout and table numbering.
                    </p>
                </div>
                <button className="flex h-11 items-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white transition-all outline-none hover:bg-gray-800 active:scale-95">
                    <Plus className="h-4 w-4" />
                    Add Section
                </button>
            </div>

            <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border border-dashed border-gray-200 bg-gray-50/50 p-12">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-none">
                    <PenTool className="h-8 w-8 text-gray-200" />
                </div>
                <h3 className="text-base font-bold text-gray-900">
                    Interactive Canvas coming soon
                </h3>
                <p className="mt-1 mb-6 text-sm text-gray-400">
                    Drag and drop tables to match your physical space.
                </p>
                <div className="flex gap-3">
                    <button className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition-all hover:bg-gray-100">
                        Add Square Table
                    </button>
                    <button className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 transition-all hover:bg-gray-100">
                        Add Round Table
                    </button>
                </div>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                        <Users className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Section Properties</h3>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Section Name</label>
                        <input
                            type="text"
                            defaultValue="Main Dining"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Total Seats</label>
                        <input
                            type="number"
                            defaultValue={48}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">
                            Assigned Printer
                        </label>
                        <ModernSelect
                            options={[
                                { value: 'receipt1', label: 'Main Receipt Printer' },
                                { value: 'bar1', label: 'Bar Ticket Printer' },
                            ]}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

function OrderScreenView(): React.JSX.Element {
    return (
        <div className="space-y-8 pb-12">
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                        <Monitor className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">POS UI Preferences</h3>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">POS Mode</label>
                        <ModernSelect
                            options={[
                                { value: 'table', label: 'Table Service' },
                                { value: 'quick', label: 'Quick Order' },
                            ]}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">
                            Future Orders (Days)
                        </label>
                        <input
                            type="number"
                            defaultValue={7}
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                        <BadgeCheck className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Order Restrictions</h3>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {[
                        { label: 'Allow split checks', active: true },
                        { label: 'Allow transfer to another table', active: true },
                        { label: 'Require reason for void', active: true },
                        { label: 'Allow change dining option after fire', active: false },
                    ].map((opt, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/30 p-4"
                        >
                            <span className="text-sm font-bold text-gray-700">{opt.label}</span>
                            <div
                                className={cn(
                                    'relative h-5 w-9 rounded-full transition-all duration-200',
                                    opt.active ? 'bg-[#DDF853]' : 'bg-gray-200'
                                )}
                            >
                                <div
                                    className={cn(
                                        'absolute top-1 h-3 w-3 rounded-full bg-white shadow-none transition-all duration-200',
                                        opt.active ? 'right-1' : 'left-1'
                                    )}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MobileDiningView(): React.JSX.Element {
    return (
        <div className="space-y-8 pb-12">
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <QrCode className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">QR Code Ordering 🇪🇹</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-600">
                            Highly Adopted in Addis
                        </span>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">
                            QR Service Status
                        </label>
                        <ModernSelect
                            options={[
                                { value: 'active', label: 'Active' },
                                { value: 'disabled', label: 'Disabled' },
                            ]}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Payment via QR</label>
                        <ModernSelect
                            options={[
                                { value: 'telebirr', label: 'Telebirr & CBE Birr' },
                                { value: 'disabled', label: 'Disabled' },
                            ]}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">QR Landing Page</label>
                        <button className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 text-xs font-bold text-gray-700 transition-all hover:bg-gray-100">
                            <Plus className="h-4 w-4" /> Customize Brand
                        </button>
                    </div>
                </div>
                <div className="mt-8 flex gap-3">
                    <button className="flex h-11 items-center gap-2 rounded-xl bg-black px-6 text-sm font-bold text-white transition-all outline-none hover:bg-gray-800 active:scale-95">
                        <Download className="h-4 w-4" />
                        Download all QR codes (ZIP)
                    </button>
                </div>
            </div>
        </div>
    );
}

function RevenueCentersView(): React.JSX.Element {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="group relative w-72">
                        <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-black" />
                        <input
                            type="text"
                            placeholder="Search centers..."
                            className="h-11 w-full rounded-xl border-none bg-gray-50 pr-4 pl-12 text-sm font-medium transition-all placeholder:text-gray-400 focus:bg-gray-100/50 focus:ring-0 focus:outline-none"
                        />
                    </div>
                </div>
                <button className="flex h-11 items-center gap-2 rounded-xl bg-black px-5 text-sm font-bold text-white transition-all outline-none hover:bg-gray-800">
                    <Plus className="h-4 w-4" /> Add Revenue Center
                </button>
            </div>

            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-none">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-50 bg-gray-50/50">
                            <th className="px-8 py-5 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                Name
                            </th>
                            <th className="px-8 py-5 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                Assigned Menu
                            </th>
                            <th className="px-8 py-5 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                Tax Rate
                            </th>
                            <th className="px-8 py-5 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                Primary Printer
                            </th>
                            <th className="px-8 py-5 text-right text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm font-medium">
                        {[
                            {
                                name: 'Dining Room',
                                menu: 'Main Menu',
                                tax: 'VAT (15%)',
                                printer: 'Floor Printer',
                            },
                            {
                                name: 'Terrace Bar',
                                menu: 'Bar Menu',
                                tax: 'VAT (15%)',
                                printer: 'Bar Printer',
                            },
                            {
                                name: 'VIP Lounge',
                                menu: 'VIP Exclusive',
                                tax: 'VAT (15%)',
                                printer: 'Floor Printer',
                            },
                        ].map((rc, i) => (
                            <tr
                                key={i}
                                className="group cursor-pointer transition-colors hover:bg-gray-50/50"
                            >
                                <td className="px-8 py-4 font-bold text-gray-900">{rc.name}</td>
                                <td className="px-8 py-4 text-gray-600">{rc.menu}</td>
                                <td className="px-8 py-4 text-gray-600">{rc.tax}</td>
                                <td className="px-8 py-4 text-gray-600">{rc.printer}</td>
                                <td className="px-8 py-4 text-right">
                                    <button className="text-gray-300 hover:text-gray-900">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function MessagingView(): React.JSX.Element {
    return (
        <div className="space-y-8 pb-12">
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                        <MessageSquare className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Broadcast to Staff</h3>
                </div>
                <div className="space-y-4">
                    <textarea
                        placeholder="Type a message to push to all active POS terminals..."
                        className="h-32 w-full resize-none rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                    />
                    <div className="flex justify-end">
                        <button className="flex h-12 items-center gap-2 rounded-xl bg-black px-8 text-sm font-bold text-white transition-all outline-none hover:bg-gray-800 active:scale-95">
                            Broadcast Now
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-none">
                <div className="border-b border-gray-50 px-8 py-6">
                    <h3 className="text-base font-bold text-gray-900">Pre-Shift Notes</h3>
                </div>
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-gray-50 bg-gray-50/50">
                            <th className="px-8 py-4 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                Note
                            </th>
                            <th className="px-8 py-4 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                Expiration
                            </th>
                            <th className="px-8 py-4 text-right text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm font-medium">
                        {[
                            {
                                note: 'VIP Guest "Abebe" arriving at 7PM. Table 4.',
                                exp: 'End of shift',
                            },
                            { note: 'Doro Wot is low stock. Inform guests.', exp: 'End of shift' },
                        ].map((n, i) => (
                            <tr key={i} className="transition-colors hover:bg-gray-50/50">
                                <td className="px-8 py-4 font-bold text-gray-900">{n.note}</td>
                                <td className="px-8 py-4 text-gray-600">{n.exp}</td>
                                <td className="px-8 py-4 text-right">
                                    <button className="text-xs font-bold text-red-400 transition-colors hover:text-red-600">
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="flex justify-center border-t border-gray-50 bg-gray-50/30 p-4">
                    <button className="flex items-center gap-2 text-xs font-bold text-gray-400 transition-colors hover:text-gray-900">
                        <Plus className="h-3 w-3" /> Add Pre-Shift Note
                    </button>
                </div>
            </div>
        </div>
    );
}
