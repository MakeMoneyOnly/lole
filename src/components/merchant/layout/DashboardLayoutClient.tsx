'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';
import { Sidebar } from './Sidebar';
import { RightPanel } from './RightPanel';
import { CommandBarShell } from './CommandBarShell';
import { MobileBottomNav } from './MobileBottomNav';
import { MerchantHeader } from './MerchantHeader';

/**
 * Inner shell — must be a child of SidebarProvider so it can
 * read isCollapsed and adjust the main content margin.
 */
function DashboardShell({ children }: { children: React.ReactNode }): React.JSX.Element {
    const { isCollapsed: _isCollapsed } = useSidebar();

    return (
        <>
            {/* 1. Sidebar (Fixed Left) */}
            <Sidebar />

            {/* 2. Main Space */}
            <div
                className={cn(
                    // Base flex column, fills remaining width
                    'flex flex-1 flex-col overflow-hidden',
                    // Left margin responds to sidebar width — smooth CSS transition
                    // Exact same curve/duration as sidebar for perfect sync
                    'transition-all duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]'
                )}
            >
                <MerchantHeader />

                <main
                    id="main-content"
                    className="flex-1 overflow-y-auto bg-white transition-all duration-300"
                    tabIndex={-1}
                >
                    <div className="w-full px-4 pt-2 pb-24 sm:px-6 sm:pb-8 lg:px-6">{children}</div>
                </main>
            </div>

            {/* 3. Right Panel (Full height) */}
            <RightPanel />

            <MobileBottomNav />
            <CommandBarShell />
        </>
    );
}

export function DashboardLayoutClient({
    children,
}: {
    children: React.ReactNode;
}): React.JSX.Element {
    // Lock scroll for dashboard experience
    React.useLayoutEffect(() => {
        const html = document.documentElement;
        const body = document.body;

        const originalHtmlStyle = html.style.cssText;
        const originalBodyStyle = body.style.cssText;

        html.style.height = '100%';
        html.style.overflow = 'hidden';
        body.style.height = '100%';
        body.style.overflow = 'hidden';

        return () => {
            html.style.cssText = originalHtmlStyle;
            body.style.cssText = originalBodyStyle;
        };
    }, []);

    return (
        <SidebarProvider>
            <DashboardShell>{children}</DashboardShell>
        </SidebarProvider>
    );
}
