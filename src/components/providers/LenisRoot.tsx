'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ReactLenis } from 'lenis/react';

export function LenisRoot({ children }: { children: ReactNode }): React.JSX.Element {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Keep server and first client render identical to avoid hydration mismatches.
    if (!isMounted) {
        return (<>{children}</>) as React.JSX.Element;
    }

    return <ReactLenis root>{children}</ReactLenis>;
}
