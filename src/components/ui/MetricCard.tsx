'use client';

import { type LucideIcon } from 'lucide-react';
import { type ReactElement } from 'react';

interface MetricCardProps {
    icon: LucideIcon;
    chip: string;
    value: string | number;
    label: string;
    subLabel?: string;
    tone?: 'blue' | 'green' | 'purple' | 'amber' | 'rose';
    progress?: number;
    targetLabel?: string;
    currentLabel?: string;
}

const toneClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
};

export function MetricCard({
    icon: Icon,
    chip,
    value,
    label,
    subLabel,
    tone = 'blue',
    progress = 0,
    targetLabel,
    currentLabel,
}: MetricCardProps): ReactElement {
    return (
        <div className="card-shadow flex flex-col gap-3 rounded-4xl bg-white p-5">
            <div className="flex items-start justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                    <Icon className="h-5 w-5 text-gray-700" />
                </span>
                <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${toneClasses[tone]}`}
                >
                    {chip}
                </span>
            </div>
            <div>
                <p className="text-3xl font-bold tracking-tight text-black">{value}</p>
                <p className="text-sm font-semibold text-gray-900">{label}</p>
                {subLabel && <p className="text-xs text-gray-500">{subLabel}</p>}
            </div>
            {progress > 0 && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                        className="h-full rounded-full bg-current transition-all"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>
            )}
            {targetLabel && currentLabel && (
                <div className="flex justify-between text-[10px] text-gray-500">
                    <span>{targetLabel}</span>
                    <span>{currentLabel}</span>
                </div>
            )}
        </div>
    );
}
