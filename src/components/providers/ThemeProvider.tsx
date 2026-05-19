'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';

/* eslint-disable no-console */
// Suppress the specific React 19 warning caused by next-themes' FOUC prevention script
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const orig = console.error;
    console.error = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
            return;
        }
        orig.apply(console, args);
    };
}
/* eslint-enable no-console */

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>): React.JSX.Element {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
