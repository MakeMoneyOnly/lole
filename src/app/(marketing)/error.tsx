'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Error Boundary for Marketing Routes
 * Catches runtime errors and provides recovery options for public pages
 */
export default function MarketingError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}): React.JSX.Element {
    const router = useRouter();

    useEffect(() => {
        logger.error('[Marketing Error Boundary]:', error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 p-4">
            <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-8 text-center shadow-lg">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                    <AlertTriangle className="h-8 w-8 text-amber-600" />
                </div>

                <h2 className="mb-2 text-xl font-semibold text-gray-900">Something went wrong</h2>

                <p className="mb-6 text-sm text-gray-600">
                    {error.message || 'We encountered an unexpected error. Please try again.'}
                </p>

                {error.digest && (
                    <p className="mb-4 rounded bg-gray-100 px-3 py-1.5 font-mono text-xs text-gray-500">
                        Error ID: {error.digest}
                    </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Try again
                    </button>

                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50"
                    >
                        <Home className="h-4 w-4" />
                        Go Home
                    </button>
                </div>
            </div>
        </div>
    );
}
