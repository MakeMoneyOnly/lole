'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useRef, useState } from 'react';

// Chart skeleton loader for better UX during lazy loading
const ChartSkeleton = (): React.JSX.Element => (
    <div className="h-[300px] w-full animate-pulse rounded-2xl bg-gray-50/50" />
);

// Lazy load the entire chart component to reduce initial bundle by ~300KB
// This uses Next.js dynamic import which handles code splitting automatically
const RevenueChartContent = dynamic(() => import('./RevenueChartContent'), {
    loading: () => <ChartSkeleton />,
    ssr: false, // Chart doesn't need SSR - saves server resources
});

interface ChartPoint {
    label: string;
    income: number;
    previous: number;
}

interface RevenueChartProps {
    data?: ChartPoint[];
}

const RevenueChart = ({ data = [] }: RevenueChartProps): React.JSX.Element => {
    const [mounted, setMounted] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

    useEffect(() => setMounted(true), []);
    useEffect(() => {
        if (!mounted || !containerRef.current || typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (!entry) return;
            const width = Math.floor(entry.contentRect.width);
            const height = Math.floor(entry.contentRect.height);
            if (width > 0 && height > 0) {
                setChartSize({ width, height });
            }
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [mounted]);

    // Prevent hydration mismatch and show skeleton during initial mount
    if (!mounted) return <ChartSkeleton />;

    return (
        <div ref={containerRef} className="h-[350px] w-full select-none">
            {chartSize.width > 0 && chartSize.height > 0 ? (
                <RevenueChartContent
                    data={data}
                    width={chartSize.width}
                    height={chartSize.height}
                />
            ) : (
                <ChartSkeleton />
            )}
        </div>
    );
};

export default RevenueChart;
