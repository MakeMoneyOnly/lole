import { HTMLAttributes, forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'glass' | 'elevated' | 'flat';
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
    ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
        const variants = {
            default:
                'bg-surface-raised border border-brand-neutral-soft/10 shadow-soft hover:shadow-medium transition-shadow duration-300',
            glass: 'backdrop-blur-xl bg-surface-overlay border border-white/20 shadow-glass',
            elevated: 'bg-surface-raised shadow-strong border border-brand-neutral-soft/10',
            flat: 'bg-surface-muted border border-brand-neutral-soft/5',
        };

        const paddings = {
            none: 'p-0',
            sm: 'p-4',
            md: 'p-6',
            lg: 'p-8',
        };

        return (
            <div
                ref={ref}
                className={cn(
                    'overflow-hidden rounded-xl',
                    variants[variant],
                    paddings[padding],
                    className
                )}
                {...props}
            >
                {children}
            </div>
        );
    }
);

Card.displayName = 'Card';
