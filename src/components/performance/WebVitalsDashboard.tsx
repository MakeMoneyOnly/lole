'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '@/components/ui';
import { Activity, Gauge, Loader2, MousePointer2, Timer, Zap, BarChart3 } from 'lucide-react';
import {
    type WebVitalName,
    type WebVitalMetric,
    formatVitalValue,
    getVitalColor,
    getVitalBgColor,
    getVitalBadgeColor,
    getVitalChartDataColor,
    observeWebVitals,
    disconnectObservers,
    calculateWebVitalsScore,
    getAggregateStats,
    getChartData,
} from '@/lib/monitoring/webVitalsTracker';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';

interface VitalCardProps {
    name: WebVitalName;
    value: number;
    rating: 'good' | 'needs-improvement' | 'poor';
    description: string;
    icon: React.ReactNode;
    stats?: {
        avg: number;
        min: number;
        max: number;
        count: number;
    } | null;
}

const VitalCard: React.FC<VitalCardProps> = ({ name, value, rating, description, icon, stats }) => {
    const colorClass = getVitalColor(rating);
    const bgClass = getVitalBgColor(rating);

    return (
        <div className={`rounded-xl border p-4 ${bgClass}`}>
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`${colorClass}`}>{icon}</div>
                    <span className="font-medium text-slate-700">{name}</span>
                </div>
                <span
                    className={`text-xs font-semibold uppercase ${getVitalBadgeColor(rating)} rounded-full px-2 py-0.5`}
                >
                    {rating.replace('-', ' ')}
                </span>
            </div>
            <div className={`text-2xl font-bold ${colorClass}`}>
                {formatVitalValue(name, value)}
            </div>
            {stats && stats.count > 1 && (
                <div className="mt-2 text-xs text-slate-500">
                    <span>Avg: {formatVitalValue(name, stats.avg)}</span>
                    <span className="mx-1">•</span>
                    <span>{stats.count} samples</span>
                </div>
            )}
            <p className="mt-1 text-xs text-slate-500">{description}</p>
        </div>
    );
};

interface WebVitalsDashboardProps {
    className?: string;
    showHistory?: boolean;
}

const VITAL_DESCRIPTIONS: Record<WebVitalName, string> = {
    LCP: 'Largest Contentful Paint - Loading performance',
    FID: 'First Input Delay - Interactivity',
    CLS: 'Cumulative Layout Shift - Visual stability',
    FCP: 'First Contentful Paint - Initial render',
    TTFB: 'Time to First Byte - Server response',
    INP: 'Interaction to Next Paint - Responsiveness',
};

const VITAL_ICONS: Record<WebVitalName, React.ReactNode> = {
    LCP: <Timer className="h-5 w-5" />,
    FID: <MousePointer2 className="h-5 w-5" />,
    CLS: <Activity className="h-5 w-5" />,
    FCP: <Zap className="h-5 w-5" />,
    TTFB: <Gauge className="h-5 w-5" />,
    INP: <Gauge className="h-5 w-5" />,
};

const VITAL_THRESHOLDS: Record<WebVitalName, { good: number; poor: number }> = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    TTFB: { good: 800, poor: 1800 },
    INP: { good: 200, poor: 500 },
};

export const WebVitalsDashboard: React.FC<WebVitalsDashboardProps> = ({
    className = '',
    showHistory = false,
}) => {
    const [vitals, setVitals] = useState<Record<WebVitalName, WebVitalMetric | null>>({
        LCP: null,
        FID: null,
        CLS: null,
        FCP: null,
        TTFB: null,
        INP: null,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        observeWebVitals(metric => {
            setVitals(prev => ({
                ...prev,
                [metric.name]: metric,
            }));
            setIsLoading(false);
        });

        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 5000);

        return () => {
            clearTimeout(timer);
            disconnectObservers();
        };
    }, []);

    const coreVitals: WebVitalName[] = ['LCP', 'FID', 'CLS'];
    const additionalVitals: WebVitalName[] = ['FCP', 'TTFB', 'INP'];
    const score = useMemo(() => calculateWebVitalsScore(vitals), [vitals]);

    const getScoreColor = (score: number): string => {
        if (score >= 9) return 'text-green-600';
        if (score >= 6) return 'text-amber-600';
        return 'text-red-600';
    };

    const allMetricsReceived = coreVitals.every(name => vitals[name] !== null);

    return (
        <div className={className}>
            <Card.Root variant="elevated" className="p-6">
                <Card.Header>
                    <div className="mb-6 flex items-center justify-between">
                        <div>
                            <Card.Title asChild>
                                <h2 className="text-xl font-semibold text-slate-800">
                                    Core Web Vitals
                                </h2>
                            </Card.Title>
                            <Card.Description>Real-time performance monitoring</Card.Description>
                        </div>
                        <div className="text-right">
                            <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
                                {score.toFixed(0)}/10
                            </div>
                            <p className="text-xs text-slate-500">Performance Score</p>
                        </div>
                    </div>
                </Card.Header>

                <Card.Content>
                    {!allMetricsReceived && (
                        <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                            Waiting for all Core Web Vitals to load...
                        </div>
                    )}

                    {isLoading && Object.values(vitals).every(v => v === null) ? (
                        <div className="flex h-48 items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <h3 className="mb-3 text-sm font-medium text-slate-600">
                                    Core Metrics
                                </h3>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    {coreVitals.map(name => {
                                        const vital = vitals[name];
                                        if (!vital) return null;
                                        return (
                                            <VitalCard
                                                key={name}
                                                name={name}
                                                value={vital.value}
                                                rating={vital.rating}
                                                description={VITAL_DESCRIPTIONS[name]}
                                                icon={VITAL_ICONS[name]}
                                                stats={getAggregateStats(name)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>

                            {showHistory && (
                                <div>
                                    <h3 className="mb-3 text-sm font-medium text-slate-600">
                                        Additional Metrics
                                    </h3>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                        {additionalVitals.map(name => {
                                            const vital = vitals[name];
                                            if (!vital) return null;
                                            return (
                                                <VitalCard
                                                    key={name}
                                                    name={name}
                                                    value={vital.value}
                                                    rating={vital.rating}
                                                    description={VITAL_DESCRIPTIONS[name]}
                                                    icon={VITAL_ICONS[name]}
                                                    stats={getAggregateStats(name)}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {showHistory && allMetricsReceived && (
                                <div className="mt-6">
                                    <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-600">
                                        <BarChart3 className="h-4 w-4" />
                                        Historical Trends
                                    </h3>
                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                        <MetricChart name="LCP" vitals={vitals} />
                                        <MetricChart name="CLS" vitals={vitals} />
                                        <MetricChart name="FID" vitals={vitals} />
                                        <MetricChart name="INP" vitals={vitals} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Card.Content>
            </Card.Root>
        </div>
    );
};

interface MetricChartProps {
    name: WebVitalName;
    vitals: Record<WebVitalName, WebVitalMetric | null>;
}

const MetricChart: React.FC<MetricChartProps> = ({ name, vitals }) => {
    const chartData = useMemo(() => getChartData(name), [name]);
    const currentVital = vitals[name];
    const thresholds = VITAL_THRESHOLDS[name];

    if (chartData.length < 2) {
        return (
            <div className="rounded-lg border border-slate-200 p-4">
                <h4 className="mb-2 text-sm font-medium text-slate-700">{name} Trend</h4>
                <div className="flex h-32 items-center justify-center text-sm text-slate-400">
                    Collecting data...
                </div>
            </div>
        );
    }

    const formatXAxis = (timestamp: number): string => {
        const date = new Date(timestamp);
        return `${date.getMinutes()}:${String(date.getSeconds()).padStart(2, '0')}`;
    };

    const formatYAxis = (value: number): string => {
        if (name === 'CLS') return value.toFixed(2);
        return Math.round(value) + '';
    };

    return (
        <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium text-slate-700">{name} Trend</h4>
                {currentVital && (
                    <span className={`text-xs ${getVitalColor(currentVital.rating)}`}>
                        Current: {formatVitalValue(name, currentVital.value)}
                    </span>
                )}
            </div>
            <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                            dataKey="timestamp"
                            tickFormatter={formatXAxis}
                            tick={{ fontSize: 10 }}
                            stroke="#94a3b8"
                        />
                        <YAxis
                            tickFormatter={formatYAxis}
                            tick={{ fontSize: 10 }}
                            stroke="#94a3b8"
                            domain={['dataMin - 10%', 'dataMax + 10%']}
                        />
                        <Tooltip
                            labelFormatter={value => new Date(value).toLocaleTimeString()}
                            formatter={value => {
                                if (typeof value === 'number') {
                                    return [formatVitalValue(name, value), name];
                                }
                                return [String(value), name];
                            }}
                            contentStyle={{ fontSize: '12px' }}
                        />
                        <ReferenceLine
                            y={thresholds.good}
                            stroke="#22c55e"
                            strokeDasharray="2 2"
                            strokeWidth={1}
                        />
                        <ReferenceLine
                            y={thresholds.poor}
                            stroke="#ef4444"
                            strokeDasharray="2 2"
                            strokeWidth={1}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke={getVitalChartDataColor(currentVital?.rating || 'good')}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export const WebVitalsSummary: React.FC<{
    vitals: Record<WebVitalName, WebVitalMetric | null>;
}> = ({ vitals }) => {
    const coreVitals: WebVitalName[] = ['LCP', 'FID', 'CLS'];

    const statusCounts = coreVitals.reduce(
        (acc, name) => {
            const vital = vitals[name];
            if (!vital) return acc;
            if (vital.rating === 'good') acc.good++;
            else if (vital.rating === 'needs-improvement') acc.needsImprovement++;
            else acc.poor++;
            return acc;
        },
        { good: 0, needsImprovement: 0, poor: 0 }
    );

    return (
        <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-green-50 p-2 text-center">
                <div className="text-lg font-bold text-green-600">{statusCounts.good}</div>
                <div className="text-xs text-green-700">Good</div>
            </div>
            <div className="rounded-lg bg-red-50 p-2 text-center">
                <div className="text-lg font-bold text-red-600">
                    {statusCounts.poor + statusCounts.needsImprovement}
                </div>
                <div className="text-xs text-red-700">Needs Work</div>
            </div>
        </div>
    );
};
