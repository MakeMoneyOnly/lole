'use client';

import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { PowerSyncProvider } from '@/lib/sync/usePowerSync';
import { ServiceWorkerCleanup } from '@/components/providers/ServiceWorkerCleanup';
import { SkipLink } from '@/components/ui/SkipLink';
import { Toaster } from 'react-hot-toast';

export function ClientProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
    return (
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            <ServiceWorkerCleanup />
            <SkipLink href="#main-content">Skip to main content</SkipLink>
            <PowerSyncProvider>
                <QueryProvider>
                    {children}
                    <Toaster
                        position="top-center"
                        toastOptions={{
                            style: {
                                background: '#333',
                                color: '#fff',
                                borderRadius: '9999px',
                            },
                            success: {
                                iconTheme: {
                                    primary: '#22c55e',
                                    secondary: '#fff',
                                },
                            },
                        }}
                    />
                </QueryProvider>
            </PowerSyncProvider>
        </ThemeProvider>
    );
}
