'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Error Boundary for Dashboard Routes
 * Catches runtime errors and provides recovery options
 */
export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}): React.JSX.Element {
    const router = useRouter();

    useEffect(() => {
        // Log the error to an error reporting service
        logger.error('[Dashboard Error Boundary]', error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
            <div className="w-full max-w-md rounded-xl border border-red-100 bg-red-50 p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>

                <h2 className="mb-2 text-xl font-semibold text-gray-900">Something went wrong</h2>

                <p className="mb-6 text-sm text-gray-600">
                    {error.message || 'An unexpected error occurred while loading this page.'}
                </p>

                {error.digest && (
                    <p className="mb-4 rounded bg-gray-100 px-3 py-1.5 font-mono text-xs text-gray-500">
                        Error ID: {error.digest}
                    </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Try again
                    </button>

                    <button
                        onClick={() => router.push('/merchant')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                        <Home className="h-4 w-4" />
                        Go to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
