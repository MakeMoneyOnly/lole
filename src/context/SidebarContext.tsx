'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { usePathname } from 'next/navigation';

interface SidebarContextValue {
    /** True when we are anywhere except the exact /merchant home page */
    isCollapsed: boolean;
}

const SidebarContext = createContext<SidebarContextValue>({ isCollapsed: false });

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const isCollapsed = useMemo(() => {
        // Sidebar is collapsed on every tab except the Home tab
        return pathname !== '/merchant';
    }, [pathname]);

    return <SidebarContext.Provider value={{ isCollapsed }}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextValue {
    return useContext(SidebarContext);
}
