'use client';

import React from 'react';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';

export function PublishChangesTab(): React.JSX.Element {
    return (
        <div className="flex max-w-4xl flex-col gap-8">
            {/* Header Banner */}
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#DDF853] bg-[#DDF853]/20 p-6 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#DDF853]">
                        <UploadCloud className="h-6 w-6 text-black" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">3 Unpublished Changes</h2>
                        <p className="text-sm font-medium text-gray-700">
                            Review your changes before publishing to devices and online ordering.
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    <button className="rounded-xl bg-[#DDF853] px-5 py-2.5 text-sm font-bold text-black transition-all hover:brightness-105">
                        Publish All
                    </button>
                </div>
            </div>

            {/* Changes List */}
            <div className="overflow-hidden rounded-[2rem] border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
                    <h3 className="text-sm font-bold text-gray-900">Pending Edits</h3>
                </div>
                <div className="divide-y divide-gray-100">
                    <div className="flex gap-4 p-6 transition-colors hover:bg-gray-50">
                        <div className="mt-1">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h4 className="text-sm font-bold text-gray-900">
                                Price Update: Doro Wat
                            </h4>
                            <p className="text-xs font-medium text-gray-500">
                                Changed price from 400 ETB to 450 ETB in Main Courses category.
                            </p>
                        </div>
                        <div className="text-xs font-bold text-gray-400">2 hrs ago</div>
                    </div>
                    <div className="flex gap-4 p-6 transition-colors hover:bg-gray-50">
                        <div className="mt-1">
                            <AlertCircle className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h4 className="text-sm font-bold text-gray-900">Availability: Tibs</h4>
                            <p className="text-xs font-medium text-gray-500">
                                Marked as Sold Out for POS and Online Ordering.
                            </p>
                        </div>
                        <div className="text-xs font-bold text-gray-400">Yesterday</div>
                    </div>
                    <div className="flex gap-4 p-6 transition-colors hover:bg-gray-50">
                        <div className="mt-1">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h4 className="text-sm font-bold text-gray-900">
                                New Item: Avocado Juice
                            </h4>
                            <p className="text-xs font-medium text-gray-500">
                                Added to Beverages category with price 120 ETB.
                            </p>
                        </div>
                        <div className="text-xs font-bold text-gray-400">Yesterday</div>
                    </div>
                </div>
            </div>

            <div className="rounded-[2rem] border-b border-gray-100 bg-gray-50 p-6">
                <h4 className="mb-4 text-sm font-bold text-gray-900">Publish Targets</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
                        <div>
                            <div className="text-sm font-bold text-gray-900">POS Terminals</div>
                            <div className="text-xs font-medium text-gray-500">
                                Updates 3 devices
                            </div>
                        </div>
                        <div className="rounded-md bg-green-50 px-2 py-1 text-xs font-bold text-green-700">
                            Online
                        </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
                        <div>
                            <div className="text-sm font-bold text-gray-900">Online Ordering</div>
                            <div className="text-xs font-medium text-gray-500">
                                Delivery partners
                            </div>
                        </div>
                        <div className="rounded-md bg-green-50 px-2 py-1 text-xs font-bold text-green-700">
                            Connected
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
