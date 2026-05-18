'use client';

import React from 'react';
import { FileCheck, Calculator, Download, Scale, Info } from 'lucide-react';

export function TaxTab(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* VAT Collected Report */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <FileCheck className="h-5 w-5" />
                            </div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">VAT Collected</h3>
                                <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                            </div>
                        </div>
                        <button className="flex h-11 items-center gap-2 rounded-xl bg-[#DDF853] px-6 text-sm font-bold text-black transition-all active:scale-[0.98]">
                            <Download className="h-4 w-4" strokeWidth={2.5} />
                            Sigtas VAT Export
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4">
                            <span className="text-sm font-bold text-gray-400">Taxable Sales</span>
                            <span className="text-base font-bold text-gray-900">48,043.00 ETB</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-[#DDF853]/20 p-4">
                            <span className="text-sm font-bold text-gray-900">VAT @ 15%</span>
                            <span className="text-lg font-bold text-black">7,206.45 ETB</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4">
                            <span className="text-sm font-bold text-gray-400">
                                VAT-Exempt Sales
                            </span>
                            <span className="text-base font-bold text-gray-900">0.00 ETB</span>
                        </div>
                    </div>
                </div>

                {/* MAT Check Report */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Calculator className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-bold text-gray-900">
                                    MAT Check Report
                                </h3>
                                <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                            </div>
                            <p className="text-[10px] font-bold text-gray-400">YTD Projection</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4">
                            <span className="text-sm font-semibold text-gray-500">
                                Annual Turnover (ETB)
                            </span>
                            <span className="text-sm font-bold text-gray-900">1,250,000</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4">
                            <span className="text-sm font-semibold text-gray-500">
                                2.5% MAT Threshold
                            </span>
                            <span className="text-sm font-bold text-gray-900">31,250</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-gray-50/50 p-4">
                            <span className="text-sm font-semibold text-gray-400">
                                Income Tax Liability
                            </span>
                            <span className="text-sm font-bold text-gray-900">45,000</span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-green-50 p-4">
                            <span className="text-sm font-bold text-gray-900">MAT Applicable</span>
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                                No
                            </span>
                        </div>
                        <p className="mt-2 text-center text-xs text-gray-400">
                            Income Tax Liability is greater than MAT threshold.
                        </p>
                    </div>
                </div>

                {/* Service Charge Report */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none md:col-span-2">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Scale className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">Service Charges</h3>
                            <Info className="h-4 w-4 cursor-pointer text-gray-400 transition-colors" />
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-xs font-bold text-gray-400">
                                <tr>
                                    <th className="px-4 py-3">Charge Type</th>
                                    <th className="px-4 py-3">Count</th>
                                    <th className="px-4 py-3 text-right">Collected (ETB)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-sm font-semibold text-gray-900">
                                <tr>
                                    <td className="px-4 py-4">Standard 10% Service Charge</td>
                                    <td className="px-4 py-4">312</td>
                                    <td className="px-4 py-4 text-right">4,500.00</td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-4">Large Group (15%)</td>
                                    <td className="px-4 py-4">12</td>
                                    <td className="px-4 py-4 text-right">500.00</td>
                                </tr>
                                <tr className="bg-gray-50/50">
                                    <td className="px-4 py-4 font-bold">Total Service Charges</td>
                                    <td className="px-4 py-4">324</td>
                                    <td className="px-4 py-4 text-right font-bold">5,000.00</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
