'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Utensils } from 'lucide-react';

/**
 * Error Boundary for Guest Routes
 * Catches runtime errors and provides recovery options for guest users
 */
export default function GuestError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const router = useRouter();

    useEffect(() => {
        console.error('[Guest Error Boundary]:', error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-orange-50 p-4">
            <div className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-8 text-center shadow-lg">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                    <AlertTriangle className="h-8 w-8 text-amber-600" />
                </div>

                <h2 className="mb-2 text-xl font-semibold text-gray-900">
                    Oops! Something went wrong
                </h2>

                <p className="mb-6 text-sm text-gray-600">
                    {error.message || 'We encountered an issue loading the menu. Please try again.'}
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
                        onClick={() => router.refresh()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-50"
                    >
                        <Utensils className="h-4 w-4" />
                        Refresh Page
                    </button>
                </div>
            </div>
        </div>
    );
}
