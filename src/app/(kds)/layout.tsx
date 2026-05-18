import React from 'react';
import { RoleGuard } from '@/components/auth/guards/RoleGuard';

// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic';

/**
 * Skip Link Component for Accessibility
 * Allows keyboard users to skip directly to main content
 */
function SkipLink(): React.JSX.Element {
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-green-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none"
        >
            Skip to orders
        </a>
    );
}

export default function KDSLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
    return (
        <RoleGuard allowedRoles={['kitchen', 'bar', 'admin', 'manager', 'owner']}>
            <div className="font-manrope flex h-dvh min-h-0 w-screen flex-col overflow-hidden bg-gray-50 text-gray-900">
                {/* Skip Link for Accessibility */}
                <SkipLink />

                <main
                    id="main-content"
                    className="relative min-h-0 flex-1 bg-gray-50"
                    tabIndex={-1}
                >
                    {children}
                </main>
            </div>
        </RoleGuard>
    );
}

