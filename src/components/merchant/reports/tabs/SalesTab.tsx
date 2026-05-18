'use client';

import React, { useState, useMemo } from 'react';
import {
    TrendingUp,
    ListFilter,
    BarChart3,
    PieChart,
    Tag,
    XCircle,
    Store,
    Download,
    ArrowUpDown,
    MoreHorizontal,
    Info,
    ChevronLeft,
    ChevronRight,
    ArrowUp,
    ArrowDown,
    ArrowRight,
} from 'lucide-react';
import { ModernSelect } from '../../shared/ModernSelect';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ChartTooltip,
    ResponsiveContainer,
} from 'recharts';

const RAW_SALES_DATA = [
    { id: 1, item: 'Doro Wot', cat: 'Food', qty: 45, gross: 13500, net: 11739, tax: 1761 },
    { id: 2, item: 'Shiro', cat: 'Food', qty: 62, gross: 6200, net: 5391, tax: 809 },
    { id: 3, item: 'St. George Beer', cat: 'Drinks', qty: 120, gross: 6000, net: 5217, tax: 783 },
    { id: 4, item: 'Tej', cat: 'Drinks', qty: 15, gross: 3000, net: 2608, tax: 392 },
    { id: 5, item: 'Kitfo', cat: 'Food', qty: 30, gross: 10500, net: 9130, tax: 1370 },
    { id: 6, item: 'Tibs', cat: 'Food', qty: 85, gross: 21250, net: 18478, tax: 2772 },
    { id: 7, item: 'Coffee', cat: 'Drinks', qty: 210, gross: 5250, net: 4565, tax: 685 },
    { id: 8, item: 'Bottled Water', cat: 'Drinks', qty: 150, gross: 3000, net: 2608, tax: 392 },
    { id: 9, item: 'Pasta', cat: 'Food', qty: 40, gross: 6000, net: 5217, tax: 783 },
    { id: 10, item: 'Salad', cat: 'Food', qty: 25, gross: 2500, net: 2174, tax: 326 },
    { id: 11, item: 'Sprite', cat: 'Drinks', qty: 45, gross: 1350, net: 1174, tax: 176 },
    { id: 12, item: 'Firfir', cat: 'Food', qty: 35, gross: 4200, net: 3652, tax: 548 },
];

export function SalesTab(): React.JSX.Element {
    // Data Grid States
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(
        null
    );
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [actionMenuOpenId, setActionMenuOpenId] = useState<number | null>(null);

    // Sorting Logic
    const sortedData = useMemo(() => {
        const sortableItems = [...RAW_SALES_DATA];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                const aValue = (a as Record<string, string | number>)[sortConfig.key];
                const bValue = (b as Record<string, string | number>)[sortConfig.key];
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [sortConfig]);

    // Pagination Logic
    const totalItems = sortedData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginatedData = sortedData.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSort = (key: string): React.JSX.Element => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleActionMenu = (id: number): React.JSX.Element => {
        setActionMenuOpenId(actionMenuOpenId === id ? null : id);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            {/* Summary Report */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900">Summary Report</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors hover:text-gray-900" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {[
                        [
                            {
                                label: 'Net Sales',
                                isCurrency: true,
                                value: '124,500',
                                change: '12%',
                                isUp: true,
                                type: 'bar1',
                            },
                            {
                                label: 'Gross Sales',
                                isCurrency: true,
                                value: '143,175',
                                change: '8%',
                                isUp: true,
                                type: 'bar2',
                            },
                        ],
                        [
                            {
                                label: 'Tax Collected',
                                isCurrency: true,
                                value: '18,675',
                                change: '10%',
                                isUp: true,
                                type: 'circle1',
                            },
                            {
                                label: 'Service Charges',
                                isCurrency: true,
                                value: '5,000',
                                change: '5%',
                                isUp: true,
                                type: 'circle2',
                            },
                        ],
                        [
                            {
                                label: 'Discounts Applied',
                                isCurrency: true,
                                value: '-2,500',
                                change: '2%',
                                isUp: false,
                                type: 'bar1',
                            },
                            {
                                label: 'Voids',
                                isCurrency: true,
                                value: '-800',
                                change: '1%',
                                isUp: false,
                                type: 'bar2',
                            },
                        ],
                        [
                            {
                                label: 'Refunds',
                                isCurrency: true,
                                value: '-1,200',
                                change: '4%',
                                isUp: false,
                                type: 'circle1',
                            },
                            {
                                label: 'Guest Count',
                                isCurrency: false,
                                value: '450',
                                change: '15%',
                                isUp: true,
                                type: 'bar1',
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
                                                <h3 className="text-base font-medium text-gray-400">
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
                                                        vs yesterday
                                                        <span
                                                            className={`flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                                                                metric.isUp
                                                                    ? 'bg-green-50 text-green-600'
                                                                    : 'bg-red-50 text-red-600'
                                                            }`}
                                                        >
                                                            {metric.isUp ? (
                                                                <ArrowUp
                                                                    strokeWidth={2.5}
                                                                    className="h-2.5 w-2.5"
                                                                />
                                                            ) : (
                                                                <ArrowDown
                                                                    strokeWidth={2.5}
                                                                    className="h-2.5 w-2.5"
                                                                />
                                                            )}{' '}
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
                                                        <div className="border-t-brand-accent border-r-brand-accent absolute -inset-1 rotate-45 rounded-full border-4 border-transparent"></div>
                                                    </div>
                                                )}
                                                {metric.type === 'circle2' && (
                                                    <div className="border-brand-accent/10 relative h-10 w-10 rounded-full border-4">
                                                        <div className="border-t-brand-accent border-l-brand-accent absolute -inset-1 rotate-12 rounded-full border-4 border-transparent"></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex border-t border-gray-100">
                                <button className="group flex flex-1 items-center justify-center gap-2 rounded-bl-3xl border-r border-gray-100 bg-gray-100/50 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-200">
                                    See details{' '}
                                    <ArrowRight
                                        strokeWidth={2}
                                        className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-rotate-12"
                                    />
                                </button>
                                <button className="group flex flex-1 items-center justify-center gap-2 rounded-br-3xl bg-gray-100/50 py-3 text-xs font-bold text-gray-900 transition-all outline-none hover:bg-gray-200">
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

            {/* Itemized Sales */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <ListFilter className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">Itemized Sales</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors hover:text-gray-900" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-48">
                            <ModernSelect
                                options={[
                                    { value: 'all', label: 'All Categories' },
                                    { value: 'food', label: 'Food' },
                                    { value: 'drinks', label: 'Drinks' },
                                ]}
                            />
                        </div>
                        <button className="flex h-11 items-center gap-2 rounded-xl bg-[#DDF853] px-6 text-sm font-bold text-black transition-all active:scale-[0.98]">
                            <Download className="h-4 w-4" strokeWidth={2.5} />
                            Export CSV
                        </button>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100/50 text-xs font-bold text-gray-500">
                                <tr>
                                    <th
                                        onClick={() => handleSort('item')}
                                        className="group/sort cursor-pointer px-4 py-3 transition-colors hover:text-black"
                                    >
                                        <div className="flex items-center gap-1">
                                            Item{' '}
                                            <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/sort:opacity-100" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('cat')}
                                        className="group/sort cursor-pointer px-4 py-3 transition-colors hover:text-black"
                                    >
                                        <div className="flex items-center gap-1">
                                            Category{' '}
                                            <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/sort:opacity-100" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('qty')}
                                        className="group/sort cursor-pointer px-4 py-3 transition-colors hover:text-black"
                                    >
                                        <div className="flex items-center gap-1">
                                            Qty Sold{' '}
                                            <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/sort:opacity-100" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('gross')}
                                        className="group/sort cursor-pointer px-4 py-3 transition-colors hover:text-black"
                                    >
                                        <div className="flex items-center gap-1">
                                            Gross (ETB){' '}
                                            <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/sort:opacity-100" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('net')}
                                        className="group/sort cursor-pointer px-4 py-3 transition-colors hover:text-black"
                                    >
                                        <div className="flex items-center gap-1">
                                            Net (ETB){' '}
                                            <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/sort:opacity-100" />
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('tax')}
                                        className="group/sort cursor-pointer px-4 py-3 transition-colors hover:text-black"
                                    >
                                        <div className="flex items-center gap-1">
                                            Tax (ETB){' '}
                                            <ArrowUpDown className="h-3 w-3 opacity-0 transition-opacity group-hover/sort:opacity-100" />
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-900">
                                {paginatedData.map((row, index, arr) => (
                                    <tr
                                        key={row.id}
                                        className="group transition-colors hover:bg-gray-50/50"
                                    >
                                        <td className="px-4 py-3.5">{row.item}</td>
                                        <td className="border-r border-gray-100/50 bg-gray-50/30 px-4 py-3.5 transition-colors group-hover:bg-white">
                                            {row.cat}
                                        </td>
                                        <td className="px-4 py-3.5">{row.qty}</td>
                                        <td className="px-4 py-3.5">
                                            {row.gross.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3.5">{row.net.toLocaleString()}</td>
                                        <td className="px-4 py-3.5">{row.tax.toLocaleString()}</td>
                                        <td className="relative px-4 py-3.5 text-right">
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    toggleActionMenu(row.id);
                                                }}
                                                className="relative z-10 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </button>

                                            {/* Action Menu Dropdown */}
                                            {actionMenuOpenId === row.id && (
                                                <div
                                                    className={`animate-in fade-in zoom-in-95 absolute right-8 z-50 w-32 rounded-xl border border-gray-100 bg-white p-1 shadow-lg ${index >= arr.length - 2 && arr.length > 3 ? 'bottom-8 mb-1' : 'top-10 mt-1'}`}
                                                >
                                                    <button className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-gray-50">
                                                        View Details
                                                    </button>
                                                    <button className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold hover:bg-gray-50">
                                                        Pin to Top
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Enterprise Pagination Footer */}
                    <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/30 px-6 py-4">
                        <span className="text-xs font-bold text-gray-400">
                            Showing {(currentPage - 1) * itemsPerPage + 1}-
                            {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
                        </span>
                        <div className="flex items-center gap-4">
                            {itemsPerPage !== totalItems && (
                                <button
                                    onClick={() => {
                                        setItemsPerPage(totalItems);
                                        setCurrentPage(1);
                                    }}
                                    className="text-xs font-bold text-gray-500 transition-all hover:text-black hover:underline active:scale-95"
                                >
                                    Load All
                                </button>
                            )}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-white"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:hover:bg-white"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Other Sections Row */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Hourly Sales */}
                <div className="group rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">Hourly Sales</h3>
                                <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors hover:text-gray-900" />
                            </div>
                        </div>
                        <span className="text-xs font-semibold text-gray-400">Live updates</span>
                    </div>

                    <div className="mt-4 h-56 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={[
                                    { hour: '7 AM', sales: 420 },
                                    { hour: '9 AM', sales: 1200 },
                                    { hour: '11 AM', sales: 3400 },
                                    { hour: '1 PM', sales: 5600 },
                                    { hour: '3 PM', sales: 2800 },
                                    { hour: '5 PM', sales: 4200 },
                                    { hour: '7 PM', sales: 6800 },
                                    { hour: '9 PM', sales: 3100 },
                                    { hour: '11 PM', sales: 800 },
                                ]}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#DDF853" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#DDF853" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    vertical={false}
                                    strokeDasharray="3 3"
                                    stroke="#F4F3EF"
                                />
                                <XAxis
                                    dataKey="hour"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#8A887A', fontSize: 10, fontWeight: 700 }}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#8A887A', fontSize: 10, fontWeight: 700 }}
                                    tickFormatter={v => `${v / 1000}k`}
                                />
                                <ChartTooltip
                                    cursor={{ stroke: '#DDF853', strokeWidth: 2 }}
                                    contentStyle={{
                                        backgroundColor: '#fff',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="sales"
                                    stroke="#DDF853"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorSales)"
                                    activeDot={{
                                        r: 6,
                                        fill: '#DDF853',
                                        stroke: '#fff',
                                        strokeWidth: 2,
                                    }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">
                            Peak Hour: <span className="text-[#98AD17]">1:00 PM - 2:00 PM</span>
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-[#DDF853]"></div>
                            <span className="text-xs font-semibold text-gray-400">Net Sales</span>
                        </div>
                    </div>
                </div>

                {/* Product Mix */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <PieChart className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">Product Mix</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors hover:text-gray-900" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-3.5 text-sm">
                            <span className="font-bold text-gray-900">Top Seller:</span>
                            <span className="font-semibold text-gray-500">St. George Beer</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-3.5 text-sm">
                            <span className="font-bold text-gray-900">Bottom Performer:</span>
                            <span className="font-semibold text-gray-500">Fruit Salad</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-3.5 text-sm">
                            <span className="font-bold text-gray-900">Most Profitable:</span>
                            <span className="font-semibold text-gray-500">Kitfo Special</span>
                        </div>

                        <div className="mt-8 space-y-4">
                            <div className="h-11 w-full overflow-hidden rounded-xl bg-gray-50/50 p-1.5">
                                <div className="h-full w-[65%] rounded-lg bg-[#DDF853] transition-all duration-1000"></div>
                            </div>
                            <div className="flex items-center justify-between px-1">
                                <p className="text-sm font-bold tracking-tight text-gray-500">
                                    65% Food / 35% Drinks
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#DDF853]"></span>
                                    <span className="text-xs font-semibold text-gray-400">
                                        Category balance
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Discounts */}
                <div className="flex flex-col rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Tag className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">Discounts</h3>
                                <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors hover:text-gray-900" />
                            </div>
                        </div>
                        <div className="w-32">
                            <ModernSelect options={[{ value: 'all', label: 'All Types' }]} />
                        </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/30">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50/50 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                <tr>
                                    <th className="px-5 py-3">Discount Type</th>
                                    <th className="px-5 py-3">Usage</th>
                                    <th className="px-5 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm font-semibold text-gray-900">
                                <tr className="hover:bg-gray-50/50">
                                    <td className="px-5 py-4">Staff Meal (100%)</td>
                                    <td className="px-5 py-4 text-gray-500">12 Applied</td>
                                    <td className="px-5 py-4 text-right">2,400 ETB</td>
                                </tr>
                                <tr className="hover:bg-gray-50/50">
                                    <td className="px-5 py-4">Manager Comp</td>
                                    <td className="px-5 py-4 text-gray-500">1 Applied</td>
                                    <td className="px-5 py-4 text-right">100 ETB</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Voids */}
                <div className="flex flex-col rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <XCircle className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">Voids</h3>
                                <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors hover:text-gray-900" />
                            </div>
                        </div>
                        <div className="w-32">
                            <ModernSelect options={[{ value: 'all', label: 'All Staff' }]} />
                        </div>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-gray-100">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                                <tr>
                                    <th className="px-5 py-3">Reason</th>
                                    <th className="px-5 py-3">Staff</th>
                                    <th className="px-5 py-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm font-semibold text-gray-900">
                                <tr className="hover:bg-gray-50/50">
                                    <td className="px-5 py-4">Customer Changed Mind</td>
                                    <td className="px-5 py-4 text-gray-500">Almaz</td>
                                    <td className="px-5 py-4 text-right">
                                        <p>350 ETB</p>
                                        <p className="text-[10px] text-gray-400">2 voids</p>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Order Source Report */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-8 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                        <Store className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-gray-900">Order Source Report</h3>
                        <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {[
                        [
                            {
                                label: 'Dine-in',
                                value: '85,000',
                                change: '68%',
                                isUp: true,
                                type: 'bar1',
                            },
                            {
                                label: 'Takeout',
                                value: '15,000',
                                change: '12%',
                                isUp: true,
                                type: 'bar2',
                            },
                        ],
                        [
                            {
                                label: 'Delivery',
                                value: '24,500',
                                change: '20%',
                                isUp: true,
                                type: 'circle1',
                            },
                            {
                                label: 'Online',
                                value: '0',
                                change: '0%',
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
                                                <h3 className="text-base font-medium text-gray-400">
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
                                                        <span className="text-3xl font-normal text-gray-400">
                                                            Br.
                                                        </span>
                                                        <span className="text-3xl font-bold text-black">
                                                            {metric.value}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                                                        Share
                                                        <span className="flex items-center gap-0.5 rounded-lg bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
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
        </div>
    );
}
