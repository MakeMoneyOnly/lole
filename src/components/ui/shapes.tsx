import React from 'react';
import { cn } from '@/lib/utils';

export function PriceBurst({ className }: { className?: string }): React.JSX.Element {
    return (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn('h-full w-full', className)}
        >
            <path
                d="M50 0L61.2 16.8L80.9 14.6L85.4 34L100 43.3L91.3 61.2L100 79.1L82.1 82.1L75 100L56.7 91.3L38.8 100L31.7 82.1L13.8 79.1L22.5 61.2L13.8 43.3L28.4 34L32.9 14.6L52.6 16.8L50 0Z"
                fill="#D92344"
            />
        </svg>
    );
}

export function ScallopBg({ className, active }: { className?: string; active?: boolean }): React.JSX.Element {
    return (
        <div className={cn('relative h-full w-full', className)}>
            {/* This approximates the scallop shape using CSS mask or SVG. 
             For simplicity and "exact" replication of the feel, we use a rotated sqircle or multiple divs.
             The reference used a div called 'badge-scallop'. */}
            <div
                className={cn(
                    'absolute inset-0 rotate-45 rounded-[24px] transition-colors duration-300',
                    active ? 'bg-black' : 'bg-white group-hover:bg-gray-100'
                )}
            ></div>
        </div>
    );
}
