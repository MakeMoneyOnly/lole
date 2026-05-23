import React, { Suspense } from 'react';
import { RoleGuard } from '@/components/auth/guards/RoleGuard';
import { DashboardLayoutClient } from '@/components/merchant/layout/DashboardLayoutClient';

function SkipLink(): React.JSX.Element {
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
        >
            Skip to main content
        </a>
    );
}

import { OfflineIndicator } from '@/components/providers/OfflineIndicator';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}): React.JSX.Element {
    return (
        <div
            className="font-inter flex h-screen w-full flex-col overflow-hidden bg-white"
            data-lenis-prevent
        >
            <OfflineIndicator position="top" showSyncStatus={true} />
            <div className="flex flex-1 overflow-hidden">
                <SkipLink />

                <DashboardLayoutClient>
                    <RoleGuard allowedRoles={['owner', 'admin', 'manager']}>
                        <Suspense>{children}</Suspense>
                    </RoleGuard>
                </DashboardLayoutClient>
            </div>
        </div>
    );
}
