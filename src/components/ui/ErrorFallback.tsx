'use client';

import { cn } from '@/lib/utils';

interface ErrorFallbackProps {
    error?: Error;
    reset?: () => void;
    title?: string;
    message?: string;
    severity?: 'critical' | 'warning' | 'info';
    className?: string;
}

export function ErrorFallback({
    error,
    reset,
    title,
    message,
    severity = 'warning',
    className,
}: ErrorFallbackProps): React.JSX.Element {
    const severityStyles = {
        critical: 'border-red-400 bg-red-50 text-red-800',
        warning: 'border-amber-400 bg-amber-50 text-amber-800',
        info: 'border-blue-400 bg-blue-50 text-blue-800',
    };

    const displayTitle =
        title ?? (severity === 'critical' ? 'Something went wrong' : 'An error occurred');
    const displayMessage =
        message ??
        (reset
            ? 'Please try again or contact support if the issue persists.'
            : 'Please contact support for assistance.');

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-4 rounded-xl border p-8 text-center',
                severityStyles[severity],
                className
            )}
        >
            <div className="text-3xl">
                {severity === 'critical' ? '⚠' : severity === 'warning' ? '⚠' : 'ℹ'}
            </div>
            <h3 className="text-lg font-semibold">{displayTitle}</h3>
            <p className="max-w-md text-sm opacity-80">{displayMessage}</p>
            {error?.message && (
                <pre className="max-h-24 max-w-md overflow-auto rounded bg-white/50 px-3 py-2 text-left text-xs">
                    {error.message}
                </pre>
            )}
            <div className="flex gap-3">
                {reset && (
                    <button
                        onClick={reset}
                        className="rounded-full bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-white/80"
                    >
                        Try Again
                    </button>
                )}
                {error?.message && (
                    <button
                        onClick={() => {
                            void navigator.clipboard.writeText(error.message);
                        }}
                        className="rounded-full bg-white/50 px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-white/80"
                    >
                        Copy Error
                    </button>
                )}
            </div>
        </div>
    );
}
