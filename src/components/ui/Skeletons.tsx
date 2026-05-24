'use client';

import { cn } from '@/lib/utils';

interface PageSkeletonProps {
    variant?: 'pos' | 'kds' | 'dashboard' | 'guest';
    className?: string;
}

interface ChartSkeletonProps {
    height?: string;
    className?: string;
}

interface TableSkeletonProps {
    rows?: number;
    cols?: number;
    className?: string;
}

interface CardSkeletonProps {
    className?: string;
}
function SkeletonBlock({ className }: { className?: string }): React.JSX.Element {
    return <div className={cn('animate-pulse rounded-lg bg-neutral-200', className)} />;
}

export function PageSkeleton({
    variant = 'dashboard',
    className,
}: PageSkeletonProps): React.JSX.Element {
    if (variant === 'pos') {
        return (
            <div className={cn('flex h-screen flex-col gap-4 p-4', className)}>
                <SkeletonBlock className="h-12 w-48" />
                <div className="grid flex-1 grid-cols-2 gap-4">
                    <SkeletonBlock className="h-full rounded-xl" />
                    <SkeletonBlock className="h-full rounded-xl" />
                </div>
            </div>
        );
    }

    if (variant === 'kds') {
        return (
            <div className={cn('flex h-screen gap-4 p-4', className)}>
                <SkeletonBlock className="w-64 rounded-xl" />
                <div className="flex flex-1 flex-col gap-4">
                    <SkeletonBlock className="h-12 w-40" />
                    <div className="grid flex-1 grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <SkeletonBlock key={i} className="rounded-xl" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (variant === 'guest') {
        return (
            <div className={cn('flex flex-col gap-6 p-4', className)}>
                <SkeletonBlock className="h-48 w-full rounded-xl" />
                <SkeletonBlock className="h-8 w-64" />
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <SkeletonBlock key={i} className="h-32 rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    // dashboard default
    return (
        <div className={cn('flex h-screen', className)}>
            <SkeletonBlock className="hidden w-64 rounded-none lg:block" />
            <div className="flex flex-1 flex-col gap-6 p-6">
                <SkeletonBlock className="h-12 w-48" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <SkeletonBlock key={i} className="h-32 rounded-xl" />
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <SkeletonBlock className="h-64 rounded-xl" />
                    <SkeletonBlock className="h-64 rounded-xl" />
                </div>
            </div>
        </div>
    );
}

export function ChartSkeleton({
    height = 'h-64',
    className,
}: ChartSkeletonProps): React.JSX.Element {
    return (
        <div className={cn('flex flex-col gap-4', className)}>
            <SkeletonBlock className="h-6 w-32" />
            <SkeletonBlock className={cn('w-full rounded-xl', height)} />
            <div className="flex gap-2">
                <SkeletonBlock className="h-4 w-16" />
                <SkeletonBlock className="h-4 w-16" />
            </div>
        </div>
    );
}

export function TableSkeleton({
    rows = 5,
    cols = 4,
    className,
}: TableSkeletonProps): React.JSX.Element {
    return (
        <div className={cn('flex flex-col gap-3', className)}>
            <div className="flex gap-4">
                {Array.from({ length: cols }).map((_, i) => (
                    <SkeletonBlock key={i} className="h-4 flex-1" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4">
                    {Array.from({ length: cols }).map((_, j) => (
                        <SkeletonBlock key={j} className="h-8 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function CardSkeleton({ className }: CardSkeletonProps): React.JSX.Element {
    return <SkeletonBlock className={cn('h-32 w-full rounded-xl', className)} />;
}
