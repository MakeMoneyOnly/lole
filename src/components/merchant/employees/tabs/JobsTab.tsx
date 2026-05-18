'use client';

import React, { useState } from 'react';
import { Briefcase, Plus, Edit2, Shield } from 'lucide-react';
import { ModernSelect } from '../../shared/ModernSelect';

export function JobsTab(): React.JSX.Element {
    const [isAdding, setIsAdding] = useState(false);

    if (isAdding) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Add Job Role</h2>
                        <p className="text-sm text-gray-500">
                            Configure wages and permissions for a new job.
                        </p>
                    </div>
                    <button
                        onClick={() => setIsAdding(false)}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                </div>

                <div className="space-y-8">
                    {/* Basic Info */}
                    <div className="rounded-3xl border border-gray-100 bg-white p-8">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Briefcase className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Basic Information</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Job Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="e.g. Senior Server"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Tipped Job
                                </label>
                                <div className="flex h-[46px] items-center justify-between rounded-xl border border-gray-200 bg-gray-50/30 px-4">
                                    <span className="text-sm font-semibold text-gray-900">
                                        Participates in Tip Pool
                                    </span>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input type="checkbox" className="peer sr-only" />
                                        <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-[#DDF853] peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Default Wage (ETB)
                                </label>
                                <input
                                    type="number"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Wage Type
                                </label>
                                <ModernSelect
                                    options={[
                                        { value: 'monthly', label: 'Monthly' },
                                        { value: 'daily', label: 'Daily' },
                                        { value: 'hourly', label: 'Hourly' },
                                    ]}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Permissions */}
                    <div className="rounded-3xl border border-gray-100 bg-white p-8">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Shield className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">
                                Access & Permissions
                            </h3>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2 md:w-1/2">
                                <label className="text-sm font-medium text-gray-400">
                                    POS Access Level
                                </label>
                                <ModernSelect
                                    options={[
                                        { value: 'none', label: 'No Access' },
                                        { value: 'basic', label: 'Basic Ordering' },
                                        { value: 'manager', label: 'Manager (Voids/Discounts)' },
                                    ]}
                                />
                            </div>

                            <div>
                                <label className="mb-3 block text-sm font-medium text-gray-400">
                                    Web Dashboard Modules
                                </label>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    {[
                                        'View Reports',
                                        'Manage Menu',
                                        'Manage Inventory',
                                        'Manage Employees',
                                        'View Cash Drawer',
                                        'Access Settings',
                                    ].map((perm, i) => (
                                        <div
                                            key={i}
                                            className="flex h-[46px] items-center justify-between rounded-xl border border-gray-100 bg-gray-50/10 px-4"
                                        >
                                            <span className="text-sm font-semibold text-gray-900">
                                                {perm}
                                            </span>
                                            <label className="relative inline-flex cursor-pointer items-center">
                                                <input type="checkbox" className="peer sr-only" />
                                                <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-[#DDF853] peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button
                            onClick={() => setIsAdding(false)}
                            className="rounded-xl border border-gray-200 px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => setIsAdding(false)}
                            className="rounded-xl bg-[#DDF853] px-8 py-3 text-sm font-bold text-black transition-all hover:brightness-105 active:scale-95"
                        >
                            Save Job Options
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="flex items-center justify-end">
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-black active:scale-95"
                >
                    <Plus className="h-4 w-4" />
                    Create Job
                </button>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-8">
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase">
                            <tr>
                                <th className="px-4 py-3">Job Name</th>
                                <th className="px-4 py-3">Tipped</th>
                                <th className="px-4 py-3">Default Wage</th>
                                <th className="px-4 py-3">POS Level</th>
                                <th className="px-4 py-3">Employees</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm font-semibold text-gray-900">
                            {[
                                {
                                    name: 'Server',
                                    tipped: true,
                                    wage: '1,500 ETB / Month',
                                    pos: 'Basic',
                                    emps: 12,
                                },
                                {
                                    name: 'Line Cook',
                                    tipped: true,
                                    wage: '5,000 ETB / Month',
                                    pos: 'No Access',
                                    emps: 8,
                                },
                                {
                                    name: 'Cashier',
                                    tipped: false,
                                    wage: '3,500 ETB / Month',
                                    pos: 'Manager',
                                    emps: 4,
                                },
                            ].map((job, i) => (
                                <tr key={i} className="hover:bg-gray-50/30">
                                    <td className="px-4 py-4">{job.name}</td>
                                    <td className="px-4 py-4">
                                        {job.tipped ? (
                                            <span className="rounded-lg bg-green-50 px-2 py-1 text-[10px] font-bold text-green-600 uppercase">
                                                Yes
                                            </span>
                                        ) : (
                                            <span className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500 uppercase">
                                                No
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-gray-500">{job.wage}</td>
                                    <td className="px-4 py-4 text-gray-500">{job.pos}</td>
                                    <td className="px-4 py-4 text-gray-500">{job.emps} Active</td>
                                    <td className="px-4 py-4 text-right">
                                        <button className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900">
                                            <Edit2 className="h-4 w-4" />
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
