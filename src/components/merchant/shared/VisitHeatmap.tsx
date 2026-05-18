'use client';

import React from 'react';
import { Users, Plus } from 'lucide-react';

interface VisitHeatmapProps {
    columns?: number;
}

const VisitHeatmap = ({ columns = 19 }: VisitHeatmapProps): React.JSX.Element => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Generate data for 20 columns starting from 7AM
    const startHour = 7;
    const endHour = 23; // 11 PM
    const totalHours = endHour - startHour;

    const generateIntensities = (day: string): React.JSX.Element => {
        return Array.from({ length: columns }, (_, i) => {
            const progress = i / (columns - 1);
            const hour = startHour + progress * totalHours;

            // Seed randomness based on day and hour for consistent-ish lookup if re-rendered
            const seed = day.charCodeAt(0) + day.charCodeAt(1) + i;
            const pseudoRandom = (Math.sin(seed) + 1) / 2;

            let intensity = 10 + pseudoRandom * 10;

            // Lunch Peak (varies by day)
            const lunchPeak = day === 'Sun' ? 13 : day === 'Sat' ? 12.5 : 12;
            const lunchSpread = 1.5;
            if (Math.abs(hour - lunchPeak) < lunchSpread) {
                const factor = 1 - Math.abs(hour - lunchPeak) / lunchSpread;
                intensity += factor * (50 + pseudoRandom * 30);
            }

            // Dinner Peak (varies by day)
            const dinnerPeak = ['Fri', 'Sat'].includes(day) ? 19.5 : 19;
            const dinnerSpread = 2;
            if (Math.abs(hour - dinnerPeak) < dinnerSpread) {
                const factor = 1 - Math.abs(hour - dinnerPeak) / dinnerSpread;
                intensity += factor * (60 + pseudoRandom * 40);
            }

            // Morning breakfast peak for weekdays
            if (!['Sat', 'Sun'].includes(day) && Math.abs(hour - 8.5) < 1) {
                intensity += (1 - Math.abs(hour - 8.5)) * 30;
            }

            // Weekend late night
            if (['Fri', 'Sat'].includes(day) && hour > 21) {
                intensity += (hour - 21) * 10;
            }

            // Global scaling per day
            const scaling: Record<string, number> = {
                Mon: 0.8,
                Tue: 0.7,
                Wed: 0.85,
                Thu: 0.9,
                Fri: 1.1,
                Sat: 1.25,
                Sun: 1.0,
            };
            intensity *= scaling[day] || 1;

            const visits = Math.floor(intensity * (rowVisitsAvg[day] / 100));

            return {
                intensity: Math.min(100, Math.max(0, Math.floor(intensity / 10) * 10)),
                visits,
                hour: Math.floor(hour),
                minutes: Math.floor((hour % 1) * 60),
            };
        });
    };

    const rowVisitsAvg: Record<string, number> = {
        Mon: 2500,
        Tue: 2100,
        Wed: 2800,
        Thu: 3100,
        Fri: 4500,
        Sat: 5200,
        Sun: 3800,
    };

    const data = days.map(day => ({
        day,
        points: generateIntensities(day),
        opacity:
            day === 'Fri' || day === 'Sat'
                ? 'opacity-100'
                : day === 'Wed'
                  ? 'opacity-60'
                  : day === 'Sun'
                    ? 'opacity-70'
                    : 'opacity-80',
    }));

    // Labels for the 7AM - 11PM range
    const labelPoints = [0, 0.25, 0.5, 0.75, 1];
    const labels = ['7AM', '11AM', '3PM', '7PM', '11PM'];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex grow gap-6">
                {/* Y-Axis (Days) */}
                <div className="flex flex-col justify-around gap-5 py-2 text-[10px] font-bold text-gray-400">
                    {days.map(day => (
                        <span key={day}>{day}</span>
                    ))}
                </div>

                {/* Grid */}
                <div className="flex flex-1 flex-col gap-3">
                    {data.map((row, rowIndex) => (
                        <div
                            key={rowIndex}
                            className={`relative flex items-center gap-2 ${row.opacity}`}
                        >
                            {row.points.map((point, colIndex) => {
                                const bgClass =
                                    point.intensity === 0
                                        ? 'bg-gray-50'
                                        : point.intensity === 100
                                          ? 'bg-brand-accent'
                                          : `bg-brand-accent/${point.intensity}`;

                                const displayTime = `${point.hour > 12 ? point.hour - 12 : point.hour}:${point.minutes.toString().padStart(2, '0')} ${point.hour >= 12 ? 'PM' : 'AM'}`;

                                return (
                                    <div
                                        key={colIndex}
                                        className={`group relative h-8 w-full cursor-pointer rounded-lg transition-all duration-300 ${bgClass} hover:ring-brand-accent/30 hover:scale-[1.02] hover:ring-2`}
                                    >
                                        {/* Premium Custom Tooltip */}
                                        <div className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-3 flex min-w-[160px] -translate-x-1/2 translate-y-2 flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-3.5 text-gray-900 opacity-0 shadow-2xl transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                                            <div className="mb-1 flex items-center justify-between border-b border-gray-50 pb-2">
                                                <span className="text-[11px] font-medium tracking-tight text-gray-500">
                                                    {row.day}
                                                </span>
                                                <span className="text-[11px] font-medium text-gray-900">
                                                    {displayTime}
                                                </span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5 text-gray-900" />
                                                    <span className="text-base font-bold tracking-tight">
                                                        {point.visits.toLocaleString()}
                                                    </span>
                                                    <span className="text-[11px] font-medium text-gray-400">
                                                        visits
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                                                        <div
                                                            className="bg-brand-accent h-full"
                                                            style={{ width: `${point.intensity}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-500">
                                                        {point.intensity}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Tooltip Arrow */}
                                            <div className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-r border-b border-gray-100 bg-white"></div>
                                        </div>
                                    </div>
                                );
                            })}
                            {row.day === 'Mon' ? (
                                <Plus
                                    strokeWidth={2.5}
                                    className="mx-2 h-4 w-4 rotate-45 text-gray-300"
                                />
                            ) : (
                                <div
                                    className={`mx-2 h-px w-4 ${['Mon', 'Wed', 'Sun'].includes(row.day) ? 'bg-transparent' : 'bg-gray-200'}`}
                                ></div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* X-Axis (Hours) */}
            <div className="ml-[54px] flex justify-between pr-2 text-[10px] font-bold text-gray-300 uppercase">
                {labelPoints.map((progress, i) => (
                    <span
                        key={i}
                        style={{
                            width: '0',
                            textAlign: 'center',
                            overflow: 'visible',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {labels[i]}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default VisitHeatmap;
