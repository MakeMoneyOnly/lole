'use client';

import React from 'react';

export function HomePageClient(): React.JSX.Element {
    return (
        <div className="flex flex-col gap-6 p-8">
            <h1 className="text-2xl font-bold">Home</h1>
            <p className="text-gray-500">Welcome to your dashboard.</p>
        </div>
    );
}
