'use client';

import React, { useState } from 'react';
import {
    TrendingUp,
    Users,
    Wallet,
    CreditCard,
    Receipt,
    Utensils,
    Heart,
    Download,
    Filter,
    CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ModernSelect } from '../shared/ModernSelect';
import { ContemporaryCalendar } from './ContemporaryCalendar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { SalesTab } from './tabs/SalesTab';
import { LaborTab } from './tabs/LaborTab';
import { CashManagementTab } from './tabs/CashManagementTab';
import { PaymentsTab } from './tabs/PaymentsTab';
import { TaxTab } from './tabs/TaxTab';
import { MenuTab } from './tabs/MenuTab';
import { GuestTab } from './tabs/GuestTab';
import { ExportTab } from './tabs/ExportTab';

const TABS = [
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'labor', label: 'Labor', icon: Users },
    { id: 'cash', label: 'Cash Management', icon: Wallet },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'tax', label: 'Tax & Service Charges', icon: Receipt },
    { id: 'menu', label: 'Menu & Modifiers', icon: Utensils },
    { id: 'guest', label: 'Guest Data', icon: Heart },
    { id: 'export', label: 'Export Center', icon: Download },
];

export function ReportsPageClient(): React.JSX.Element {
    const [activeTab, setActiveTab] = useState('sales');
    const [dateRangeType, setDateRangeType] = useState('today_vs_last_week');
    const [customRange, setCustomRange] = useState({
        from: new Date(),
        to: new Date(),
    });

    const titles: Record<string, { title: string; desc: string }> = {
        sales: {
            title: 'Sales Reports',
            desc: 'Comprehensive overview of business sales performance.',
        },
        labor: {
            title: 'Labor & Staffing',
            desc: 'Monitor labor costs, time entries, and overtime.',
        },
        cash: {
            title: 'Cash Management',
            desc: 'Track drawer balances, payouts, and Z-report summaries.',
        },
        payments: {
            title: 'Payments',
            desc: 'Payment method breakdowns and transaction histories.',
        },
        tax: {
            title: 'Tax & Service Charges',
            desc: 'VAT reports, MAT checks (🇪🇹), and service charge summaries.',
        },
        menu: { title: 'Menu & Modifiers', desc: 'Item performance and category revenue mix.' },
        guest: {
            title: 'Guest Data',
            desc: 'Visit frequency, return rates, and loyalty program performance.',
        },
        export: {
            title: 'Export Center',
            desc: 'Schedule automated reports or perform bulk data exports.',
        },
    };

    return (
        <div className="font-inter flex min-h-screen flex-col bg-white px-10 py-8 tracking-[-0.04em]">
            {/* Dynamic Header */}
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{titles[activeTab].title}</h1>
                    <p className="mt-2 text-sm font-medium text-gray-500">
                        {titles[activeTab].desc}
                    </p>
                </div>
            </div>

            {/* Enterprise Filter Bar (Deep Filtering & Comparative Dates) */}
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Date Picker & Calendar System */}
                    <div className="flex items-center gap-3 pr-4 md:border-r md:border-gray-200">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-gray-400" />
                            <div className="w-56">
                                <ModernSelect
                                    value={dateRangeType}
                                    onChange={setDateRangeType}
                                    className="!border-transparent !bg-transparent !px-0 !py-0 !text-sm hover:!border-transparent"
                                    options={[
                                        {
                                            value: 'today_vs_last_week',
                                            label: 'Today vs Same Day Last Week',
                                        },
                                        {
                                            value: 'this_week_vs_last',
                                            label: 'This Week vs Last Week',
                                        },
                                        { value: 'q1_26_vs_q1_25', label: 'Q1 2026 vs Q1 2025' },
                                        { value: 'custom', label: 'Custom Date Range...' },
                                    ]}
                                />
                            </div>
                        </div>

                        {/* Conditionally reveal custom calendar for custom ranges */}
                        {dateRangeType === 'custom' && (
                            <div className="animate-in fade-in slide-in-from-left-2 ml-2 flex items-center gap-2 duration-300">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold text-black transition-all outline-none hover:bg-gray-100/80 active:scale-95">
                                            <span className="font-medium whitespace-nowrap text-gray-400">
                                                From/To:
                                            </span>
                                            {format(customRange.from, 'MMM d')} -{' '}
                                            {format(customRange.to, 'MMM d')}
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        className="overflow-hidden rounded-2xl border-none p-0 shadow-2xl"
                                        align="start"
                                    >
                                        <ContemporaryCalendar
                                            initialFrom={customRange.from}
                                            initialTo={customRange.to}
                                            onSelect={setCustomRange}
                                        />
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        )}
                    </div>

                    {/* Deep Filtering (Multi-dimensional) */}
                    <div className="flex items-center gap-4">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <div className="w-40">
                            <ModernSelect
                                className="!border-transparent !bg-transparent !px-0 !py-0 !text-sm !font-medium !text-gray-600 hover:!border-transparent hover:!text-gray-900"
                                options={[
                                    { value: 'all', label: 'All Categories' },
                                    { value: 'beverages', label: 'Beverages' },
                                    { value: 'food', label: 'Food' },
                                    { value: 'merchandise', label: 'Merchandise' },
                                ]}
                            />
                        </div>
                        <div className="w-44 border-l border-gray-200 pl-4">
                            <ModernSelect
                                className="!border-transparent !bg-transparent !px-0 !py-0 !text-sm !font-medium !text-gray-600 hover:!border-transparent hover:!text-gray-900"
                                options={[
                                    { value: 'all', label: 'All Revenue Centers' },
                                    { value: 'main', label: 'Main Dining' },
                                    { value: 'patio', label: 'Patio' },
                                    { value: 'bar', label: 'Bar' },
                                ]}
                            />
                        </div>
                        <div className="w-36 border-l border-gray-200 pl-4">
                            <ModernSelect
                                className="!border-transparent !bg-transparent !px-0 !py-0 !text-sm !font-medium !text-gray-600 hover:!border-transparent hover:!text-gray-900"
                                options={[
                                    { value: 'all', label: 'All Order Types' },
                                    { value: 'dine_in', label: 'Dine-In' },
                                    { value: 'takeout', label: 'Takeout' },
                                    { value: 'delivery', label: 'Delivery' },
                                ]}
                            />
                        </div>
                    </div>
                </div>

                {/* Additional Actions */}
                <div className="flex items-center gap-3">
                    {/* Calendar System Dropdown moved to the right */}
                    <div className="w-44">
                        <ModernSelect
                            className="bg-white"
                            options={[
                                { value: 'gc', label: 'Gregorian Calendar' },
                                { value: 'ec', label: 'Ethiopian Calendar' },
                            ]}
                        />
                    </div>
                </div>
            </div>

            {/* 2. Navigation Tabs */}
            <div className="no-scrollbar mb-8 flex items-center gap-2 overflow-x-auto border-b border-gray-200">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'group relative flex items-center gap-2.5 px-4 py-4 text-sm font-medium whitespace-nowrap transition-all',
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
                {activeTab === 'sales' && <SalesTab />}
                {activeTab === 'labor' && <LaborTab />}
                {activeTab === 'cash' && <CashManagementTab />}
                {activeTab === 'payments' && <PaymentsTab />}
                {activeTab === 'tax' && <TaxTab />}
                {activeTab === 'menu' && <MenuTab />}
                {activeTab === 'guest' && <GuestTab />}
                {activeTab === 'export' && <ExportTab />}
            </div>
        </div>
    );
}
