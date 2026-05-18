'use client';

import React from 'react';
import { Plus, Search, Edit2, Trash2 } from 'lucide-react';

export function ModifierGroupsTab(): React.JSX.Element {
    return (
        <div className="flex max-w-5xl flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Modifier Groups</h2>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                        Manage customizations and add-ons
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search groups..."
                            className="w-64 rounded-xl border border-gray-200 py-2 pr-4 pl-9 text-sm focus:border-transparent focus:ring-2 focus:ring-black focus:outline-none"
                        />
                    </div>
                    <button className="flex items-center gap-2 rounded-xl bg-[#DDF853] px-4 py-2 text-sm font-bold text-black transition-colors hover:brightness-105">
                        <Plus className="h-4 w-4" />
                        Add Group
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-[2rem] border-b border-gray-100 bg-white">
                <table className="w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-6 py-4 text-xs font-bold text-gray-500">
                                Group Name
                            </th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500">Rules</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500">Options</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-gray-500">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        <tr className="group transition-colors hover:bg-gray-50">
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900">
                                        Meat Temperature
                                    </span>
                                    <span className="text-xs font-medium text-gray-500">
                                        Amharic: የስጋ ብስለት
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                                    Required (1 to 1)
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-sm font-medium text-gray-600">4 options</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-black">
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <tr className="group transition-colors hover:bg-gray-50">
                            <td className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-900">Extra Toppings</span>
                                </div>
                            </td>
                            <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">
                                    Optional (0 to 5)
                                </span>
                            </td>
                            <td className="px-6 py-4">
                                <span className="text-sm font-medium text-gray-600">8 options</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-black">
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
