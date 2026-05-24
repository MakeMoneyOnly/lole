'use client';

import React, { useState } from 'react';
import { Users, Search, Plus, Edit2, Lock, Wallet, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernSelect } from '../../shared/ModernSelect';

export function TeamManagementTab(): React.JSX.Element {
    const [isAdding, setIsAdding] = useState(false);

    if (isAdding) {
        return (
            <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Add Employee</h2>
                        <p className="text-sm text-gray-500">
                            Create a new employee profile and configure access.
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
                    {/* PERSONAL INFO */}
                    <div className="rounded-3xl border border-gray-100 bg-white p-8">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Users className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">
                                Personal Information
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    First Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="Abebe"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Father's Name (Middle Name) 🇪🇹{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="Kebede"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Grandfather's Name (Last Name)
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="Tessema"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Phone Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="+251 911 234 567"
                                    defaultValue="+251 "
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="abebe@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Date of Birth
                                </label>
                                <input
                                    type="date"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">Gender</label>
                                <ModernSelect
                                    options={[
                                        { value: 'male', label: 'Male' },
                                        { value: 'female', label: 'Female' },
                                    ]}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    National / Fayda / Kebele ID 🇪🇹{' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="ID Number"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Sub-city / Woreda 🇪🇹
                                </label>
                                <div className="flex gap-2">
                                    <div className="w-1/2">
                                        <ModernSelect
                                            options={[
                                                { value: 'bole', label: 'Bole' },
                                                { value: 'yeka', label: 'Yeka' },
                                                { value: 'kirkos', label: 'Kirkos' },
                                            ]}
                                            placeholder="Sub-city"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        className="w-1/2 rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                        placeholder="Woreda"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 md:col-span-3">
                                <label className="text-sm font-medium text-gray-400">
                                    Profile Photo
                                </label>
                                <div className="flex items-center gap-4">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                                        <ImageIcon className="h-6 w-6" />
                                    </div>
                                    <button className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
                                        Upload Image
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ACCOUNT INFORMATION */}
                    <div className="rounded-3xl border border-gray-100 bg-white p-8">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Lock className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Account & Access</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    POS Access Code (4-6 digits){' '}
                                    <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="password"
                                    maxLength={6}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold tracking-widest text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="••••"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Web Dashboard Access
                                </label>
                                <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3">
                                    <span className="text-sm font-semibold text-gray-900">
                                        Invite to Create Web Account
                                    </span>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input type="checkbox" className="peer sr-only" />
                                        <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-[#DDF853] peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Web Role
                                </label>
                                <ModernSelect
                                    options={[
                                        { value: 'staff', label: 'Staff' },
                                        { value: 'manager', label: 'Manager' },
                                        { value: 'admin', label: 'Admin' },
                                    ]}
                                />
                            </div>
                        </div>
                    </div>

                    {/* EMPLOYMENT DETAILS 🇪🇹 */}
                    <div className="rounded-3xl border border-gray-100 bg-white p-8">
                        <div className="mb-6 flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Wallet className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">
                                Employment Details 🇪🇹
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Job Assignment <span className="text-red-500">*</span>
                                </label>
                                <ModernSelect
                                    options={[
                                        { value: 'server', label: 'Server' },
                                        { value: 'cashier', label: 'Cashier' },
                                        { value: 'cook', label: 'Line Cook' },
                                    ]}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Employment Type
                                </label>
                                <ModernSelect
                                    options={[
                                        { value: 'permanent', label: 'Permanent' },
                                        { value: 'contract', label: 'Contract' },
                                        { value: 'daily', label: 'Daily Laborer' },
                                    ]}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Base Wage (ETB) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="e.g. 5000"
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
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    POESSA Pension (7%/11%)
                                </label>
                                <div className="flex h-[46px] items-center justify-between rounded-xl border border-gray-200 bg-gray-50/30 px-4">
                                    <span className="text-sm font-semibold text-gray-900">
                                        Include in Pension
                                    </span>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="peer sr-only"
                                        />
                                        <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-[#DDF853] peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                    </label>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Payroll Bank 🇪🇹
                                </label>
                                <ModernSelect
                                    options={[
                                        {
                                            value: 'cbe',
                                            label: 'Commercial Bank of Ethiopia (CBE)',
                                        },
                                        { value: 'awash', label: 'Awash Bank' },
                                        { value: 'dashen', label: 'Dashen Bank' },
                                        { value: 'amhara', label: 'Amhara Bank' },
                                    ]}
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Account Number
                                </label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50/30 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                    placeholder="1000..."
                                />
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
                            Save Employee
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
                    Add Employee
                </button>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-8">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:w-80">
                        <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search staff by name or phone..."
                            className="w-full rounded-xl border border-gray-200 bg-gray-50/30 py-2.5 pr-4 pl-10 text-sm font-medium text-gray-900 outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-40">
                            <ModernSelect
                                options={[
                                    { value: 'all', label: 'All Jobs' },
                                    { value: 'server', label: 'Server' },
                                    { value: 'cook', label: 'Line Cook' },
                                ]}
                            />
                        </div>
                        <div className="w-32">
                            <ModernSelect
                                options={[
                                    { value: 'active', label: 'Active' },
                                    { value: 'inactive', label: 'Inactive' },
                                ]}
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-400 uppercase">
                            <tr>
                                <th className="px-4 py-3">Employee</th>
                                <th className="px-4 py-3">Job Role</th>
                                <th className="px-4 py-3">Phone</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm font-semibold text-gray-900">
                            {[
                                {
                                    name: 'Almaz Tessema',
                                    job: 'Server',
                                    phone: '+251 911 234 567',
                                    status: 'Active',
                                },
                                {
                                    name: 'Dawit Mekonnen',
                                    job: 'Line Cook',
                                    phone: '+251 922 345 678',
                                    status: 'Active',
                                },
                                {
                                    name: 'Meron Hailu',
                                    job: 'Cashier',
                                    phone: '+251 933 456 789',
                                    status: 'Inactive',
                                },
                            ].map((emp, i) => (
                                <tr key={i} className="hover:bg-gray-50/30">
                                    <td className="flex items-center gap-3 px-4 py-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#DDF853]/20 text-xs font-bold text-gray-900">
                                            {emp.name.charAt(0)}
                                        </div>
                                        {emp.name}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{emp.job}</td>
                                    <td className="px-4 py-3 text-gray-500">{emp.phone}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={cn(
                                                'rounded-full px-2 py-1 text-[10px] font-bold',
                                                emp.status === 'Active'
                                                    ? 'bg-green-50 text-green-600'
                                                    : 'bg-gray-100 text-gray-500'
                                            )}
                                        >
                                            {emp.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
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
