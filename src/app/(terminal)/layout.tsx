import React, { Suspense } from 'react';
import type { Viewport } from 'next';

export default function TerminalLayout({
    children,
}: {
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <div className="font-manrope min-h-screen bg-stone-950 text-white">
            <Suspense>{children}</Suspense>
        </div>
    );
}

export const metadata = {
    title: 'lole Terminal',
    description: 'Cashier and settlement workspace',
};

export const viewport: Viewport = {
    themeColor: '#111111',
};
