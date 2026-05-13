import React from 'react';

// Force dynamic rendering for all auth pages to avoid build-time errors
export const dynamic = 'force-dynamic';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
