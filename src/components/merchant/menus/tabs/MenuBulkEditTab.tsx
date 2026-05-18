'use client';

import React from 'react';
import { Search, Tag, EyeOff, FolderOutput } from 'lucide-react';

interface MenuBulkItem extends Record<string, unknown> {
    id?: string;
    name?: string;
    price?: number;
    is_available?: boolean;
    categoryName?: string;
}

interface Category {
    id: string;
    name: string;
    items?: MenuBulkItem[];
}

export function MenuBulkEditTab({ initialData }: { initialData?: unknown }): React.JSX.Element {
    const categories = ((initialData as Record<string, unknown>)?.categories || []) as Category[];
    const allItems = categories.flatMap(cat =>
        (cat.items || []).map(item => ({ ...item, categoryName: cat.name }))
    );

    return (
        <div className="flex max-w-6xl flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Bulk Edit</h2>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                        Make changes to multiple items at once
                    </p>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search items to select..."
                        className="w-full rounded-xl border border-gray-200 py-2 pr-4 pl-9 text-sm focus:border-transparent focus:ring-2 focus:ring-black focus:outline-none"
                    />
                </div>
                <div className="mx-1 hidden h-10 w-px bg-gray-200 sm:block" />
                <button className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-none transition-colors hover:bg-gray-50 hover:text-black">
                    <Tag className="h-4 w-4" />
                    Change Prices
                </button>
                <button className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-none transition-colors hover:bg-gray-50 hover:text-black">
                    <EyeOff className="h-4 w-4" />
                    Set Availability
                </button>
                <button className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 shadow-none transition-colors hover:bg-gray-50 hover:text-black">
                    <FolderOutput className="h-4 w-4" />
                    Move Category
                </button>
            </div>

            {/* Data Grid Placeholder */}
            <div className="overflow-hidden rounded-[2rem] border-b border-gray-100 bg-white">
                <table className="w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="w-12 px-4 py-4 text-center">
                                <input
                                    type="checkbox"
                                    className="rounded text-black focus:ring-black"
                                />
                            </th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500">Item Name</th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500">Category</th>
                            <th className="px-4 py-4 text-right text-xs font-bold text-gray-500">
                                Price (ETB)
                            </th>
                            <th className="px-4 py-4 text-xs font-bold text-gray-500">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {allItems.length > 0 ? (
                            allItems.map((item: MenuBulkItem, idx: number) => (
                                <tr
                                    key={item.id || idx}
                                    className="transition-colors hover:bg-gray-50"
                                >
                                    <td className="px-4 py-3 text-center">
                                        <input
                                            type="checkbox"
                                            className="rounded text-black focus:ring-black"
                                        />
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-bold text-gray-900">{item.name}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm font-medium text-gray-600">
                                            {item.categoryName}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="text-sm font-bold text-gray-900">
                                            {item.price ?? '-'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex rounded px-2 py-0.5 text-[10px] font-bold ${item.is_available ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                                        >
                                            {item.is_available ? 'Available' : 'Unavailable'}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td
                                    colSpan={5}
                                    className="px-4 py-8 text-center text-sm text-gray-500"
                                >
                                    No items found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between px-2 text-sm font-medium text-gray-500">
                <span>0 items selected</span>
                <span>
                    Showing {allItems.length} of {allItems.length} items
                </span>
            </div>
        </div>
    );
}
