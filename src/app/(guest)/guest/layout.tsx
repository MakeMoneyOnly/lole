import React, { Suspense } from 'react';

export default function GuestAuthLayout({
    children,
}: {
    children: React.ReactNode;
}): React.JSX.Element {
    return <Suspense>{children}</Suspense>;
}
