import React, { Suspense } from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
    return <Suspense>{children}</Suspense>;
}
