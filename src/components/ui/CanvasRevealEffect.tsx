'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface CanvasRevealEffectProps {
    animationSpeed?: number;
    opacities?: number[];
    colors?: number[][];
    containerClassName?: string;
    dotSize?: number;
    showGradient?: boolean;
    reverse?: boolean;
}

export const CanvasRevealEffect = ({ containerClassName }: CanvasRevealEffectProps): React.JSX.Element => {
    return (
        <div className={cn('relative h-full w-full bg-transparent', containerClassName)}>
            {/* Simplified animated background using CSS */}
            <div className="absolute inset-0 opacity-20 dark:opacity-30">
                <div className="from-brand-accent/20 to-brand-accent/10 absolute inset-0 animate-pulse bg-gradient-to-br via-transparent" />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: `radial-gradient(circle, rgba(168, 24, 24, 0.4) 1px, transparent 1px)`,
                        backgroundSize: '24px 24px',
                        animation: 'shimmer 4s ease-in-out infinite',
                    }}
                />
            </div>
            <div
                className={cn(
                    'absolute inset-0 bg-gradient-to-t to-transparent',
                    'from-background'
                )}
            />
            <style jsx>{`
                @keyframes shimmer {
                    0%,
                    100% {
                        opacity: 0.3;
                    }
                    50% {
                        opacity: 0.6;
                    }
                }
            `}</style>
        </div>
    );
};
