import React from 'react';
import {
    SlidersHorizontal,
    LayoutDashboard,
    ChevronDown,
    Info,
    ArrowUp,
    ArrowDown,
    ArrowRight,
    Users,
    Plus,
    Search,
    ArrowUpRight,
    BarChart3,
} from 'lucide-react';
import RevenueChart from '@/components/merchant/shared/RevenueChart';
import VisitHeatmap from '@/components/merchant/shared/VisitHeatmap';
import SalesPerformanceChart from '@/components/merchant/shared/SalesPerformanceChart';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage(): Promise<React.JSX.Element> {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const rawName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Partner';
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    const hour = new Date().getHours();
    let timeGreeting = 'Welcome';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    const greeting = `${timeGreeting}, ${name}!`;

    return (
        <div className="flex min-h-full w-full flex-col bg-white py-4 tracking-[-0.04em] lg:py-6">
            {/* Page Title Area */}
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                <div className="pl-5">
                    <h1 className="mb-1 text-2xl font-bold text-gray-900">{greeting}</h1>
                    <p className="mb-6 text-sm text-gray-500">
                        Here is how your restaurant is performing today.
                    </p>

                    {/* Search Bar (Moved from Header) */}
                    <div className="group relative w-[520px]">
                        <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-black" />
                        <input
                            type="text"
                            placeholder="What are you looking for?"
                            className="h-11 w-full appearance-none rounded-xl border-none bg-gray-50 pr-4 pl-12 text-sm font-medium shadow-none transition-all placeholder:text-gray-500 focus:bg-gray-50 focus:ring-0 focus:outline-none"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-3 pr-5">
                    <button className="flex h-11 items-center gap-2 rounded-xl bg-gray-50 px-5 text-sm font-bold text-gray-700 transition-colors outline-none hover:bg-gray-100">
                        <SlidersHorizontal strokeWidth={2} className="h-4 w-4" />
                        Filters
                    </button>
                    <button className="flex h-11 items-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-bold text-white transition-all outline-none hover:bg-black">
                        <LayoutDashboard strokeWidth={2} className="h-4 w-4" />
                        Add Widget
                    </button>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 gap-6 px-5 pb-10 lg:grid-cols-12">
                {/* Left Column: Quick Actions */}
                <div className="col-span-1 flex h-full flex-col justify-between rounded-3xl border border-gray-100 bg-white p-6 lg:col-span-6">
                    <div>
                        <div className="-mt-2.5 mb-4 flex h-11 items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-medium text-gray-500">
                                    Quick actions
                                </h3>
                                <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {[
                                {
                                    label: 'Manage menu',
                                    icon: LayoutDashboard,
                                    desc: 'Update items & prices',
                                },
                                {
                                    label: 'Daily Reconciliation',
                                    icon: BarChart3,
                                    desc: 'End-of-day reports',
                                },
                                { label: 'Open terminal', icon: Plus, desc: 'Quickly open POS' },
                                {
                                    label: 'Staff roster',
                                    icon: Users,
                                    desc: 'View shift schedules',
                                },
                            ].map((action, i) => (
                                <button
                                    key={i}
                                    className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-3xl border border-transparent bg-gray-50/50 p-4 text-left transition-all duration-300 outline-none hover:border-[#DDF853]/20 hover:bg-[#DDF853]"
                                >
                                    <div className="flex w-full items-start justify-between">
                                        <div className="rounded-xl bg-white p-2 shadow-sm transition-colors group-hover:bg-black/5">
                                            <action.icon className="h-5 w-5 text-gray-900" />
                                        </div>
                                        <ArrowUpRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-black" />
                                    </div>
                                    <div>
                                        <div className="text-body font-bold text-gray-900">
                                            {action.label}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6">
                        <button className="text-body-sm group flex h-12 w-full items-center justify-between gap-1.5 rounded-xl bg-[#DDF853] px-6 leading-[21px] font-bold text-black transition-all hover:brightness-105 active:scale-[0.98]">
                            View all activities
                            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                        </button>
                    </div>
                </div>

                {/* Right Column: Metrics Stack */}
                <div className="col-span-1 flex flex-col gap-6 lg:col-span-6">
                    {/* Combined Sales & Revenue Card */}
                    <div className="flex min-h-[200px] flex-col rounded-3xl border border-gray-100 bg-white">
                        <div className="flex flex-1">
                            {/* Active Sales Half */}
                            <div className="flex flex-1 flex-col border-r border-gray-50 p-6">
                                <div>
                                    <div className="-mt-2.5 mb-0 flex h-11 items-center gap-2">
                                        <h3 className="text-base font-medium text-gray-500">
                                            Net Sales
                                        </h3>
                                        <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div className="flex flex-col gap-2">
                                            <div className="-mt-2 flex items-baseline gap-1.5">
                                                <span className="text-3xl font-normal text-gray-500">
                                                    Br.
                                                </span>
                                                <span className="text-3xl font-bold text-black">
                                                    27,064
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                                                vs yesterday
                                                <span className="flex items-center gap-0.5 rounded-lg bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                                    <ArrowUp
                                                        strokeWidth={2.5}
                                                        className="h-2.5 w-2.5"
                                                    />{' '}
                                                    12%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex h-10 items-end gap-1.5">
                                            <div className="bg-brand-accent/30 h-4 w-2 rounded-t-sm"></div>
                                            <div className="bg-brand-accent h-9 w-2 rounded-t-sm"></div>
                                            <div className="bg-brand-accent/30 h-5 w-2 rounded-t-sm"></div>
                                            <div className="bg-brand-accent/30 h-3 w-2 rounded-t-sm"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Product Revenue Half */}
                            <div className="flex flex-1 flex-col p-6">
                                <div>
                                    <div className="-mt-2.5 mb-0 flex h-11 items-center gap-2">
                                        <h3 className="text-base font-medium text-gray-500">
                                            Total Orders
                                        </h3>
                                        <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div className="flex flex-col gap-2">
                                            <div className="-mt-2 flex items-baseline gap-1.5">
                                                <span className="text-3xl font-bold text-black">
                                                    453
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                                                vs yesterday
                                                <span className="flex items-center gap-0.5 rounded-lg bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                                    <ArrowUp
                                                        strokeWidth={2.5}
                                                        className="h-2.5 w-2.5"
                                                    />{' '}
                                                    7%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="border-brand-accent/10 relative h-10 w-10 rounded-full border-4">
                                            <div className="border-t-brand-accent border-r-brand-accent absolute -inset-1 rotate-45 rounded-full border-4 border-transparent"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex border-t border-gray-50">
                            <button className="group flex flex-1 items-center justify-center gap-2 rounded-bl-3xl border-r border-gray-50 bg-gray-100 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-200">
                                See details{' '}
                                <ArrowRight
                                    strokeWidth={2}
                                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-rotate-12"
                                />
                            </button>
                            <button className="group flex flex-1 items-center justify-center gap-2 rounded-br-3xl bg-gray-100 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-200">
                                See details{' '}
                                <ArrowRight
                                    strokeWidth={2}
                                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-rotate-12"
                                />
                            </button>
                        </div>
                    </div>

                    {/* Product Overview Card */}
                    <div className="flex min-h-[200px] flex-col rounded-3xl border border-gray-100 bg-white">
                        <div className="flex flex-1">
                            {/* Total Sales Half */}
                            <div className="flex flex-1 flex-col border-r border-gray-50 p-6">
                                <div>
                                    <div className="-mt-2.5 mb-0 flex h-11 items-center gap-2">
                                        <h3 className="text-base font-medium text-gray-500">
                                            Avg. Guest Spend
                                        </h3>
                                        <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div className="flex flex-col gap-2">
                                            <div className="-mt-2 flex items-baseline gap-1.5">
                                                <span className="text-3xl font-normal text-gray-500">
                                                    Br.
                                                </span>
                                                <span className="text-3xl font-bold text-black">
                                                    3,240
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                                                vs yesterday
                                                <span className="flex items-center gap-0.5 rounded-lg bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                                    <ArrowUp
                                                        strokeWidth={2.5}
                                                        className="h-2.5 w-2.5"
                                                    />{' '}
                                                    14%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex h-10 items-end gap-1.5">
                                            <div className="bg-brand-accent/30 h-3 w-2 rounded-t-sm"></div>
                                            <div className="bg-brand-accent/30 h-6 w-2 rounded-t-sm"></div>
                                            <div className="bg-brand-accent h-9 w-2 rounded-t-sm"></div>
                                            <div className="bg-brand-accent/30 h-4 w-2 rounded-t-sm"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Avg Order Value Half */}
                            <div className="flex flex-1 flex-col p-6">
                                <div>
                                    <div className="-mt-2.5 mb-0 flex h-11 items-center gap-2">
                                        <h3 className="text-base font-medium text-gray-500">
                                            Labor Cost
                                        </h3>
                                        <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                                    </div>

                                    <div className="flex items-end justify-between">
                                        <div className="flex flex-col gap-2">
                                            <div className="-mt-2 flex items-baseline gap-1.5">
                                                <span className="text-3xl font-normal text-gray-500">
                                                    Br.
                                                </span>
                                                <span className="text-3xl font-bold text-black">
                                                    12,402
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                                                vs yesterday
                                                <span className="flex items-center gap-0.5 rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                                    <ArrowDown
                                                        strokeWidth={2.5}
                                                        className="h-2.5 w-2.5"
                                                    />{' '}
                                                    5%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="border-brand-accent/10 relative h-10 w-10 rounded-full border-4">
                                            <div className="border-t-brand-accent border-l-brand-accent absolute -inset-1 rotate-12 rounded-full border-4 border-transparent"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex border-t border-gray-50">
                            <button className="group flex flex-1 items-center justify-center gap-2 rounded-bl-3xl border-r border-gray-50 bg-gray-100 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-200">
                                See details{' '}
                                <ArrowRight
                                    strokeWidth={2}
                                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-rotate-12"
                                />
                            </button>
                            <button className="group flex flex-1 items-center justify-center gap-2 rounded-br-3xl bg-gray-100 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-200">
                                See details{' '}
                                <ArrowRight
                                    strokeWidth={2}
                                    className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-rotate-12"
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Row 2: Charts */}
                <div className="relative col-span-1 overflow-hidden rounded-3xl border border-gray-100 bg-white p-8 lg:col-span-8">
                    <div className="relative z-10 mb-8 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-medium text-gray-500">Analytics</h3>
                            <Info strokeWidth={1.5} className="h-4.5 w-4.5 text-gray-300" />
                        </div>
                        <div className="flex items-center gap-3">
                            <button className="flex h-11 items-center gap-1 rounded-xl bg-gray-50 px-4 text-sm font-bold text-gray-700 transition-colors outline-none hover:bg-gray-100">
                                This year
                                <ChevronDown
                                    strokeWidth={2}
                                    className="h-3.5 w-3.5 text-gray-500"
                                />
                            </button>
                        </div>
                    </div>

                    <div className="relative z-10 mb-10 flex items-end justify-between px-2">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-[32px] font-normal text-gray-500">Br.</span>
                                <span className="text-[32px] font-bold text-black">-4,543</span>
                                <div className="ml-1.5 flex items-center gap-1 rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                    <ArrowDown strokeWidth={2.5} className="h-2.5 w-2.5" /> 0.4%
                                </div>
                            </div>
                            <span className="text-xs font-bold text-gray-500">Total sales</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-baseline gap-3">
                                <span className="text-2xl font-bold text-gray-900">0.73%</span>
                                <div className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                    <ArrowUp strokeWidth={2.5} className="h-2.5 w-2.5" /> 13%
                                </div>
                            </div>
                            <span className="text-right text-xs font-bold text-gray-500">
                                Conv. rate
                            </span>
                        </div>
                    </div>

                    <div className="relative mt-6 h-[320px] w-full">
                        <RevenueChart
                            data={[
                                { label: 'JAN', income: 450, previous: 400 },
                                { label: 'FEB', income: 500, previous: 480 },
                                { label: 'MAR', income: 800, previous: 600 },
                                { label: 'APR', income: 700, previous: 650 },
                                { label: 'MAY', income: 1200, previous: 900 },
                                { label: 'JUN', income: 1000, previous: 850 },
                                { label: 'JUL', income: 1100, previous: 950 },
                                { label: 'AUG', income: 900, previous: 800 },
                            ]}
                        />
                    </div>
                </div>

                <div className="col-span-1 flex min-h-[500px] flex-col justify-between rounded-3xl border border-gray-100 bg-white lg:col-span-4">
                    <div className="flex h-full flex-col p-8">
                        <div className="mb-8 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-medium text-gray-500">
                                    Sales Performance
                                </h3>
                                <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                            </div>
                            <button className="flex h-11 items-center gap-1 rounded-xl bg-gray-50 px-4 text-sm font-bold text-gray-700 transition-colors outline-none hover:bg-gray-100">
                                Today
                                <ChevronDown
                                    strokeWidth={2}
                                    className="h-3.5 w-3.5 text-gray-500"
                                />
                            </button>
                        </div>

                        <div className="relative flex aspect-square w-full grow items-center justify-center">
                            <div className="absolute inset-0">
                                <SalesPerformanceChart totalSales={75} averageSales={40} />
                            </div>

                            <div className="absolute inset-0 flex flex-col items-center justify-end pb-5">
                                <div className="flex items-center gap-2">
                                    <span className="text-display-2 font-bold text-gray-900">
                                        17.9%
                                    </span>
                                    <div className="bg-brand-accent flex items-center justify-center rounded-full p-1 shadow-sm">
                                        <ArrowUp
                                            strokeWidth={3}
                                            className="h-3.5 w-3.5 text-white"
                                        />
                                    </div>
                                </div>
                                <span className="mt-1 text-sm font-medium text-gray-500">
                                    Since yesterday
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 space-y-4">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <div className="flex items-center gap-3 text-gray-500/80">
                                    <div className="bg-brand-accent h-1.5 w-4 rounded-full"></div>
                                    Total sales{' '}
                                    <span className="ml-1 font-medium text-gray-500">/ day</span>
                                </div>
                                <span className="font-medium text-gray-500">For week</span>
                            </div>
                            <div className="flex items-center justify-between text-xs font-bold">
                                <div className="flex items-center gap-3 text-gray-500/80">
                                    <div className="bg-brand-accent/30 h-1.5 w-4 rounded-full"></div>
                                    Average sales
                                </div>
                                <span className="font-medium text-gray-500">For today</span>
                            </div>
                        </div>
                    </div>
                    <button className="group flex w-full items-center justify-center gap-2 rounded-b-3xl border-t border-gray-50 bg-gray-100 py-4 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-200">
                        See details{' '}
                        <ArrowRight
                            strokeWidth={2}
                            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-rotate-12"
                        />
                    </button>
                </div>

                {/* Row 3: Bottom Metrics */}
                <div className="col-span-1 flex flex-col rounded-3xl border border-gray-100 bg-white p-8 lg:col-span-12">
                    <div className="mb-4 flex items-start justify-between">
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-medium text-gray-500">Total visits</h3>
                                <Info strokeWidth={1.5} className="h-4 w-4 text-gray-300" />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-4xl font-bold tracking-tight text-gray-900">
                                    288,822
                                </span>
                                <span className="flex items-center gap-1 rounded-lg bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                    <ArrowUp strokeWidth={2} className="h-2.5 w-2.5" /> 4%
                                </span>
                            </div>
                        </div>
                        <button className="flex h-11 items-center gap-1 rounded-xl bg-gray-50 px-4 text-sm font-bold text-gray-700 transition-colors outline-none hover:bg-gray-100">
                            Today
                            <ChevronDown strokeWidth={2} className="h-3.5 w-3.5 text-gray-500" />
                        </button>
                    </div>

                    <div className="mt-6">
                        <VisitHeatmap columns={20} />
                    </div>
                </div>
            </div>
        </div>
    );
}
