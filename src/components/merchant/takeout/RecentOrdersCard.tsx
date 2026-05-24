'use client';

import React from 'react';
import { ShoppingBag, Info } from 'lucide-react';

export function RecentOrdersCard(): React.JSX.Element {
    return (
        <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold text-gray-900">Recent Takeout Orders</h2>
                    <Info className="h-4 w-4 cursor-help text-gray-300" />
                </div>
            </div>

            <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/50 py-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-none ring-1 ring-gray-100">
                    <ShoppingBag className="h-6 w-6 text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-700">No recent orders</p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                    Standard orders list view would be here, showing real-time statuses.
                </p>
            </div>
        </div>
    );
}
