'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { formatCurrencyCompact } from '@/lib/utils/monetary';

interface ChartDataPoint {
    label: string;
    income: number;
    previous: number;
}

interface RevenueChartContentProps {
    data: ChartDataPoint[];
    width: number;
    height: number;
}

// This component is lazy-loaded via Next.js dynamic import
// to reduce the initial bundle size by ~300KB (recharts library)
const RevenueChartContent = ({ data, width, height }: RevenueChartContentProps): React.JSX.Element => {
    return (
        <AreaChart
            width={width}
            height={height}
            data={data}
            margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
        >
            <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DDF853" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#DDF853" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8A887A" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#8A887A" stopOpacity={0} />
                </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F4F3EF" />
            <Tooltip
                contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #F4F3EF',
                    borderRadius: '12px',
                    color: '#17120B',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 24px 0 rgba(23, 18, 11, 0.08)',
                    fontFamily: 'var(--font-inter)',
                    letterSpacing: '-0.04em',
                }}
                itemStyle={{
                    color: '#17120B',
                    fontFamily: 'var(--font-inter)',
                    letterSpacing: '-0.04em',
                }}
                cursor={{ stroke: '#8A887A', strokeWidth: 1, strokeDasharray: '3 3' }}
                formatter={(value, name) => {
                    const numValue = typeof value === 'number' ? value : 0;
                    return [
                        `${formatCurrencyCompact(numValue)} ETB`,
                        name === 'income' ? 'Current Period' : 'Previous Period',
                    ];
                }}
                labelStyle={{
                    color: '#8A887A',
                    marginBottom: '8px',
                    fontFamily: 'var(--font-inter)',
                    letterSpacing: '-0.04em',
                }}
            />
            <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{
                    fill: '#8A887A',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'var(--font-inter)',
                    letterSpacing: '-0.04em',
                }}
                dy={10}
            />
            <YAxis
                axisLine={false}
                tickLine={false}
                tick={{
                    fill: '#8A887A',
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'var(--font-inter)',
                    letterSpacing: '-0.04em',
                }}
                tickFormatter={value => `${(value / 1000).toFixed(0)}k`}
                domain={[0, 'auto']}
                width={40}
            />
            {/* Previous Period Area (Subtle) */}
            <Area
                type="monotone"
                dataKey="previous"
                stroke="#8A887A"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#colorPrevious)"
                fillOpacity={1}
                animationDuration={1500}
            />
            {/* Current Income Area (Prominent) */}
            <Area
                type="monotone"
                dataKey="income"
                stroke="#DDF853"
                strokeWidth={3}
                fill="url(#colorIncome)"
                fillOpacity={1}
                activeDot={{ r: 6, fill: '#DDF853', strokeWidth: 3, stroke: '#ffffff' }}
                animationDuration={1500}
            />
        </AreaChart>
    );
};

export default RevenueChartContent;
