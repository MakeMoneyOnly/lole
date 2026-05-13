import React from 'react';

// Force dynamic rendering for all guest auth pages to avoid build-time errors
export const dynamic = 'force-dynamic';

export default function GuestAuthLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
