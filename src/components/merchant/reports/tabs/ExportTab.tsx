'use client';

import React, { useState } from 'react';
import { Download, Mail, FileSpreadsheet, CalendarClock, Plus, Trash2, Info } from 'lucide-react';
import { ModernSelect } from '../../shared/ModernSelect';

export function ExportTab(): React.JSX.Element {
    const [emails, setEmails] = useState(['']);

    const addEmail = (): void => setEmails([...emails, '']);
    const updateEmail = (index: number, value: string): void => {
        const newEmails = [...emails];
        newEmails[index] = value;
        setEmails(newEmails);
    };
    const removeEmail = (index: number): void => {
        if (emails.length === 1) {
            setEmails(['']);
            return;
        }
        setEmails(emails.filter((_, i) => i !== index));
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Schedule Report */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <CalendarClock className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">Schedule Report</h3>
                                <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Report Type</label>
                            <ModernSelect
                                options={[
                                    { value: 'z_report', label: 'Z-Report (End-of-Shift)' },
                                    { value: 'weekly_sales', label: 'Weekly Sales Summary' },
                                    { value: 'labor', label: 'Labor Summary' },
                                    { value: 'tax', label: 'VAT Collected Report' },
                                ]}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">
                                    Frequency
                                </label>
                                <ModernSelect
                                    options={[
                                        { value: 'weekly', label: 'Weekly (Every Friday)' },
                                        { value: 'daily', label: 'Daily (End of Day)' },
                                        { value: 'monthly', label: 'Monthly' },
                                    ]}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-400">Time</label>
                                <ModernSelect
                                    options={[
                                        { value: '17:00', label: '5:00 PM' },
                                        { value: '00:00', label: '12:00 AM (Midnight)' },
                                        { value: '06:00', label: '6:00 AM' },
                                    ]}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-medium text-gray-400">
                                Recipients (Email Addresses)
                            </label>
                            <div className="space-y-3">
                                {emails.map((email, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Mail className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={e => updateEmail(index, e.target.value)}
                                                className="w-full rounded-xl border border-gray-200 bg-gray-50/30 py-3 pr-4 pl-10 text-sm font-semibold text-gray-900 transition-all outline-none focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]"
                                                placeholder={
                                                    index === 0
                                                        ? 'shareholder@example.com'
                                                        : 'manager@example.com'
                                                }
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeEmail(index)}
                                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-400 transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={addEmail}
                                className="flex items-center gap-2 text-sm font-bold text-gray-500 transition-colors hover:text-gray-900"
                            >
                                <Plus className="h-4 w-4" />
                                Add another email
                            </button>
                        </div>

                        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#DDF853] px-6 py-3.5 text-sm font-bold text-black transition-all active:scale-95">
                            <CalendarClock className="h-4 w-4" />
                            Create Automated Schedule
                        </button>
                    </div>
                </div>

                {/* Bulk Exports */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Download className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">Bulk Exports</h3>
                                <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="mb-6 text-sm text-gray-500">
                            Export all historical data across modules. Large exports may take a few
                            minutes to process.
                        </p>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400">Date Range</label>
                            <button className="flex w-full items-center justify-between gap-2 rounded-xl bg-gray-50/50 px-4 py-3 text-sm font-semibold text-gray-900 transition-all focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]">
                                <span className="font-medium text-gray-500">
                                    Select timeframe...
                                </span>
                                <CalendarClock className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-6">
                            <button className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#DDF853] px-4 text-sm font-bold text-black transition-all active:scale-[0.98]">
                                <FileSpreadsheet className="h-4 w-4" strokeWidth={2.5} />
                                Excel
                            </button>
                            <button className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#DDF853] px-4 text-sm font-bold text-black transition-all active:scale-[0.98]">
                                <FileSpreadsheet className="h-4 w-4" strokeWidth={2.5} />
                                CSV
                            </button>
                        </div>

                        <div className="mt-8 rounded-xl bg-gray-50/50 p-4">
                            <div className="mb-2 flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                <span className="text-xs font-bold text-gray-900">
                                    System Status
                                </span>
                            </div>
                            <p className="text-xs font-medium text-gray-500">
                                Export queue is currently empty. Jobs will process immediately.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
