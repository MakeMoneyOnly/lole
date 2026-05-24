'use client';

import React from 'react';

export function PayrollPageClient(): React.JSX.Element {
    return (
        <div className="flex flex-col gap-6 p-8">
            <h1 className="text-2xl font-bold">Payroll</h1>
            <p className="text-gray-500">Manage employee salaries and payments.</p>
        </div>
    );
}
