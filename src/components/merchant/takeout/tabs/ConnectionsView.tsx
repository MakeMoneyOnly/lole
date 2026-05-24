'use client';

import React from 'react';
import { Truck, FileText } from 'lucide-react';

export function ConnectionsView(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 duration-500">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                            <Truck className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">
                            Direct Webhook Connections
                        </h3>
                    </div>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-600">
                                Ordering API Key
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    readOnly
                                    className="flex-1 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none"
                                    value="••••••••••••••••••••"
                                />
                                <button className="rounded-xl border border-gray-100 bg-white px-4 text-xs font-bold text-gray-900 hover:bg-gray-50">
                                    Copy
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-600">
                                Webhook Endpoint
                            </label>
                            <input
                                type="text"
                                className="focus:ring-brand-accent w-full rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:ring-2"
                                placeholder="https://your-api.com/webhooks/orders"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                            <FileText className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">API Documentation</h3>
                    </div>
                    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/50 p-8 text-center">
                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-none ring-1 ring-gray-100">
                            <FileText className="h-6 w-6 text-gray-300" />
                        </div>
                        <button className="mt-6 rounded-xl bg-gray-900 px-6 py-2.5 text-xs font-bold text-white hover:bg-black">
                            View Documentation
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
