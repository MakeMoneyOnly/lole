'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, ChefHat } from 'lucide-react';
import { logger } from '@/lib/logger';

/**
 * Error Boundary for KDS (Kitchen Display System) Routes
 * Catches runtime errors and provides recovery options for kitchen staff
 */
export default function KDSError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}): React.JSX.Element {
    const router = useRouter();

    useEffect(() => {
        logger.error('[KDS Error Boundary]:', error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4">
            <div className="w-full max-w-md rounded-xl border border-red-800 bg-gray-800 p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-900/50">
                    <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>

                <h2 className="mb-2 text-xl font-semibold text-white">Kitchen Display Error</h2>

                <p className="mb-6 text-sm text-gray-400">
                    {error.message || 'The kitchen display encountered an error. Please try again.'}
                </p>

                {error.digest && (
                    <p className="mb-4 rounded bg-gray-700 px-3 py-1.5 font-mono text-xs text-gray-400">
                        Error ID: {error.digest}
                    </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                    </button>

                    <button
                        onClick={() => router.push('/kds')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-600"
                    >
                        <ChefHat className="h-4 w-4" />
                        KDS Home
                    </button>
                </div>
            </div>
        </div>
    );
}

