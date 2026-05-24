'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useRef, useState } from 'react';

const ChartSkeleton = (): React.JSX.Element => (
    <div className="h-full w-full animate-pulse rounded-full bg-gray-50/50" />
);

const SalesPerformanceChartContent = dynamic(() => import('./SalesPerformanceChartContent'), {
    loading: () => <ChartSkeleton />,
    ssr: false,
});

interface SalesPerformanceChartProps {
    totalSales: number;
    averageSales: number;
}

const SalesPerformanceChart = ({
    totalSales,
    averageSales,
}: SalesPerformanceChartProps): React.JSX.Element => {
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

    if (!mounted) return <ChartSkeleton />;

    return (
        <div ref={containerRef} className="h-full w-full select-none">
            {chartSize.width > 0 && chartSize.height > 0 ? (
                <SalesPerformanceChartContent
                    data={{ totalSales, averageSales }}
                    width={chartSize.width}
                    height={chartSize.height}
                />
            ) : (
                <ChartSkeleton />
            )}
        </div>
    );
};

export default SalesPerformanceChart;
