'use client';

import React from 'react';

export function PaymentsPageClient(): React.JSX.Element {
    return (
        <div className="flex flex-col gap-6 p-8">
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-gray-500">View transaction history and payment settings.</p>
        </div>
    );
}
