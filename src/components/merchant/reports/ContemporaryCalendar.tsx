'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    isAfter,
    isBefore,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface ContemporaryCalendarProps {
    onSelect?: (range: { from: Date; to: Date }) => void;
    initialFrom?: Date;
    initialTo?: Date;
}

export function ContemporaryCalendar({
    onSelect,
    initialFrom,
    initialTo,
}: ContemporaryCalendarProps): React.ReactElement {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [from, setFrom] = useState<Date | null>(initialFrom || null);
    const [to, setTo] = useState<Date | null>(initialTo || null);

    const nextMonth = (): void => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = (): void => setCurrentMonth(subMonths(currentMonth, 1));

    const handleDateClick = (day: Date): void => {
        if (!from || (from && to)) {
            setFrom(day);
            setTo(null);
        } else if (from && !to) {
            if (isBefore(day, from)) {
                setFrom(day);
                setTo(null);
            } else {
                setTo(day);
                onSelect?.({ from, to: day });
            }
        }
    };

    const renderHeader = (): React.JSX.Element => {
        return (
            <div className="flex items-center justify-between px-2 pt-2">
                <button
                    onClick={prevMonth}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
                >
                    <ChevronLeft className="h-4 w-4 text-gray-600" />
                </button>
                <span className="text-sm font-bold text-gray-900">
                    {format(currentMonth, 'MMMM yyyy')}
                </span>
                <button
                    onClick={nextMonth}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-gray-100"
                >
                    <ChevronRight className="h-4 w-4 text-gray-600" />
                </button>
            </div>
        );
    };

    const renderDays = (): React.JSX.Element => {
        const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        return (
            <div className="mb-2 grid grid-cols-7 border-b border-gray-50">
                {days.map((day, i) => (
                    <div
                        key={i}
                        className="flex h-8 items-center justify-center text-[10px] font-bold tracking-tighter text-gray-400 uppercase"
                    >
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = (): React.JSX.Element => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const cloneDay = day;
                const isSelected = (from && isSameDay(day, from)) || (to && isSameDay(day, to));
                const isInRange = from && to && isAfter(day, from) && isBefore(day, to);

                days.push(
                    <div
                        key={day.toString()}
                        className={cn(
                            'relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-xs font-semibold transition-all hover:bg-[#DDF853]/20',
                            !isSameMonth(day, monthStart) && 'text-gray-300',
                            isSelected && 'bg-black text-white hover:bg-black',
                            isInRange && 'bg-[#DDF853]/20 text-black',
                            isSameDay(day, new Date()) && !isSelected && 'border border-[#DDF853]'
                        )}
                        onClick={() => handleDateClick(cloneDay)}
                    >
                        <span>{format(day, 'd')}</span>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7" key={day.toString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="p-2 pt-0">{rows}</div>;
    };

    return (
        <div className="w-[280px] select-none">
            {renderHeader()}
            {renderDays()}
            {renderCells()}

            <div className="flex items-center justify-between rounded-b-xl border-t border-gray-50 bg-gray-50/50 p-3">
                <div className="text-[10px] font-bold text-gray-400">
                    {from && format(from, 'MMM d')} {to && ` - ${format(to, 'MMM d')}`}
                </div>
                <button
                    onClick={() => {
                        setFrom(null);
                        setTo(null);
                    }}
                    className="text-[10px] font-bold text-red-500 hover:underline"
                >
                    Clear
                </button>
            </div>
        </div>
    );
}
