'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, CreditCard } from 'lucide-react';
import { logger } from '@/lib/logger';

export default function TerminalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}): React.JSX.Element {
    const router = useRouter();

    useEffect(() => {
        logger.error('[Terminal Error Boundary]:', error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4">
            <div className="w-full max-w-md rounded-xl border border-red-800 bg-slate-800 p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-900/50">
                    <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>

                <h2 className="mb-2 text-xl font-semibold text-white">Terminal Error</h2>

                <p className="mb-6 text-sm text-gray-400">
                    {error.message ||
                        'The payment terminal encountered an error. Please try again.'}
                </p>

                {error.digest && (
                    <p className="mb-4 rounded bg-slate-700 px-3 py-1.5 font-mono text-xs text-gray-400">
                        Error ID: {error.digest}
                    </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                        onClick={reset}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                    </button>

                    <button
                        onClick={() => router.push('/terminal')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-slate-600"
                    >
                        <CreditCard className="h-4 w-4" />
                        Terminal Home
                    </button>
                </div>
            </div>
        </div>
    );
}

