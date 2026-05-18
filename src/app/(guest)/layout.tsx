import React from 'react';

// Force dynamic rendering for all guest pages to avoid build-time errors
export const dynamic = 'force-dynamic';

/**
 * Skip Link Component for Accessibility
 * Allows keyboard users to skip directly to main content
 */
function SkipLink(): React.JSX.Element {
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-amber-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:outline-none"
        >
            Skip to menu
        </a>
    );
}

export default function GuestLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
    return (
        <div className="flex min-h-screen flex-col bg-[var(--background)]">
            {/* Skip Link for Accessibility */}
            <SkipLink />

            {/* Guest Layout - Focused on the dining/ordering experience */}
            {/* Minimal chrome to avoid distractions */}
            <main id="main-content" tabIndex={-1}>
                {children}
            </main>
        </div>
    );
}

