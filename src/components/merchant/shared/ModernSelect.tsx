'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
    value: string;
    label: string;
}

interface ModernSelectProps {
    options: Option[];
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    className?: string;
    defaultValue?: string;
}

export function ModernSelect({
    options,
    value,
    onChange,
    placeholder = 'Select an option',
    className,
    defaultValue,
}: ModernSelectProps): React.ReactElement {
    const [isOpen, setIsOpen] = useState(false);
    const [internalValue, setInternalValue] = useState(
        value || defaultValue || options[0]?.value || ''
    );
    const containerRef = useRef<HTMLDivElement>(null);

    const currentValue = value !== undefined ? value : internalValue;
    const selectedOption = options.find(o => o.value === currentValue);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val: string): void => {
        setInternalValue(val);
        setIsOpen(false);
        onChange?.(val);
    };

    return (
        <div className={cn('relative w-full text-sm', className)} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'flex w-full items-center justify-between rounded-xl border border-gray-100 bg-gray-50/10 px-4 py-3 font-semibold text-gray-900 transition-all outline-none',
                    'hover:border-gray-200 focus:border-[#DDF853] focus:ring-1 focus:ring-[#DDF853]',
                    isOpen && 'border-[#DDF853] ring-1 ring-[#DDF853]'
                )}
            >
                <span className="truncate">{selectedOption?.label || placeholder}</span>
                <ChevronDown
                    className={cn(
                        'h-4 w-4 text-gray-400 transition-transform',
                        isOpen && 'rotate-180'
                    )}
                />
            </button>

            {isOpen && (
                <div className="animate-in fade-in zoom-in-95 absolute top-full left-0 z-50 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-gray-100 bg-white p-1 shadow-lg">
                    {options.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => handleSelect(option.value)}
                            className={cn(
                                'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-50 hover:text-gray-900',
                                currentValue === option.value
                                    ? 'bg-[#DDF853]/10 font-semibold text-black'
                                    : 'text-gray-600'
                            )}
                        >
                            <span className="truncate">{option.label}</span>
                            {currentValue === option.value && <Check className="h-4 w-4" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
