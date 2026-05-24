'use client';

import React from 'react';
import { Wallet, Banknote, Printer, FileText, Info } from 'lucide-react';

export function CashManagementTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Cash Drawer Summary */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-8 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900">Cash Drawer Summary</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4">
                            <span className="text-sm font-bold text-gray-400">Opening Float</span>
                            <span className="text-base font-bold text-gray-900">2,000.00 ETB</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4">
                            <span className="text-sm font-bold text-gray-400">Cash In (Sales)</span>
                            <span className="text-base font-bold text-gray-900">
                                + 15,450.00 ETB
                            </span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4">
                            <span className="text-sm font-bold text-gray-400">
                                Cash Out (Payouts/Refunds)
                            </span>
                            <span className="text-base font-bold text-gray-900">- 800.00 ETB</span>
                        </div>
                        <div className="my-2"></div>
                        <div className="flex items-center justify-between rounded-xl bg-[#DDF853]/20 p-4">
                            <span className="text-sm font-bold text-gray-900">
                                Expected Closing Balance
                            </span>
                            <span className="text-lg font-bold text-black">16,650.00 ETB</span>
                        </div>
                    </div>
                </div>

                {/* Payout Report */}
                <div className="flex flex-col rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Banknote className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">Payout Report</h3>
                                <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                            </div>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2">
                            <div className="relative">
                                <input type="checkbox" className="peer sr-only" />
                                <div className="peer h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-[#DDF853] peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full"></div>
                            </div>
                            <span className="text-xs font-bold text-gray-500">Unapproved Only</span>
                        </label>
                    </div>

                    <div className="flex-1 space-y-3">
                        <div className="flex justify-between rounded-xl bg-gray-50/10 p-4 text-sm font-semibold">
                            <div className="space-y-1">
                                <p className="text-gray-900">Vendor Payment (Ice)</p>
                                <p className="text-xs text-gray-400">By: Almaz • 10:30 AM</p>
                            </div>
                            <div className="text-right">
                                <p className="text-gray-900">500 ETB</p>
                                <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] text-green-600">
                                    Approved
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Z-Report (End-of-Day) */}
            {/* Z-Report Section */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-8 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-gray-900">
                                Z-Report (End-of-Day)
                            </h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                        </div>
                    </div>
                    <button className="flex h-11 items-center gap-2 rounded-xl bg-[#DDF853] px-6 text-sm font-bold text-black transition-all active:scale-[0.98]">
                        <Printer className="h-4 w-4" strokeWidth={2.5} />
                        Print Z-Report (En/Am)
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="rounded-3xl border border-gray-100 bg-gray-50/30 p-6 transition-all">
                        <h4 className="mb-4 text-sm font-bold text-gray-400">
                            Net Sales By Method
                        </h4>
                        <div className="space-y-3 text-sm leading-tight font-semibold text-gray-900">
                            <div className="flex justify-between py-1 transition-colors">
                                <span className="text-gray-500">Cash</span>
                                <span>14,650 ETB</span>
                            </div>
                            <div className="flex justify-between py-1 transition-colors">
                                <span className="text-gray-500">Telebirr</span>
                                <span>22,400 ETB</span>
                            </div>
                            <div className="flex justify-between py-1 transition-colors">
                                <span className="text-gray-500">CBE Birr</span>
                                <span>18,200 ETB</span>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-3xl border border-gray-100 bg-gray-50/30 p-6 transition-all">
                        <h4 className="mb-4 text-sm font-bold text-gray-400">Tax Breakdown</h4>
                        <div className="space-y-3 text-sm leading-tight font-semibold text-gray-900">
                            <div className="flex justify-between py-1 transition-colors">
                                <span className="text-gray-500">Taxable Sales</span>
                                <span>48,043 ETB</span>
                            </div>
                            <div className="flex justify-between py-1 transition-colors">
                                <span className="text-gray-500">VAT (15%)</span>
                                <span>7,206 ETB</span>
                            </div>
                            <div className="flex justify-between py-1 transition-colors">
                                <span className="text-gray-500">Exempt Sales</span>
                                <span>0 ETB</span>
                            </div>
                        </div>
                    </div>
                    <div className="rounded-3xl border border-gray-100 bg-gray-50/30 p-6 transition-all">
                        <h4 className="mb-4 text-sm font-bold text-gray-400">Exceptions</h4>
                        <div className="space-y-3 text-sm leading-tight font-semibold text-gray-900">
                            <div className="flex justify-between py-1 transition-colors">
                                <span className="text-gray-500">Voids</span>
                                <span>800 ETB</span>
                            </div>
                            <div className="flex justify-between py-1 transition-colors">
                                <span className="text-gray-500">Discounts</span>
                                <span>2,500 ETB</span>
                            </div>
                            <div className="flex justify-between py-1 transition-colors">
                                <span className="text-gray-500">Refunds</span>
                                <span>1,200 ETB</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
