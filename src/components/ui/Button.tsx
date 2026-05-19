import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

/**
 * Button Component
 *
 * WCAG 2.1 AA Compliant touch targets:
 * - Minimum touch target size: 44x44px (WCAG 2.1 Guideline 2.5.5)
 * - All sizes meet or exceed the minimum touch target requirement
 *
 * Size variants:
 * - sm: 44px height (minimum compliant)
 * - md: 48px height (comfortable)
 * - lg: 56px height (prominent)
 * - icon: 44x44px (minimum compliant for icon-only)
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg' | 'icon';
    isLoading?: boolean;
    /**
     * Accessible label for screen readers.
     * MED-016: REQUIRED for icon-only buttons (size="icon") for WCAG compliance.
     * Icon-only buttons must have a meaningful label describing their action.
     */
    ariaLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = 'primary',
            size = 'md',
            isLoading,
            children,
            disabled,
            ariaLabel,
            ...props
        },
        ref
    ) => {
        const baseStyles =
            'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-2';

        const variants = {
            primary:
                'bg-brand-accent text-black hover:bg-brand-accent-hover shadow-lg shadow-brand-accent/20',
            secondary: 'bg-surface-100 text-text-primary hover:bg-surface-200',
            glass: 'bg-glass-white backdrop-blur-md border border-white/40 text-text-primary hover:bg-white/90 shadow-glass',
            ghost: 'bg-transparent text-text-secondary hover:bg-surface-100/50 hover:text-text-primary',
            danger: 'bg-red-100 text-red-600 hover:bg-red-200',
        };

        // WCAG 2.1 AA: Minimum touch target is 44x44px
        // All sizes meet or exceed this requirement
        const sizes = {
            sm: 'h-11 min-h-11 px-3 text-xs', // 44px - minimum compliant
            md: 'h-12 min-h-12 px-4 text-sm', // 48px - comfortable default
            lg: 'h-14 min-h-14 px-6 text-base', // 56px - prominent
            icon: 'h-11 w-11 min-h-11 min-w-11 p-2', // 44x44px - minimum compliant
        };

        // MED-016: Enforce aria-label for icon-only buttons
        // Icon-only buttons MUST have an aria-label for accessibility
        if (size === 'icon' && !ariaLabel) {
            if (process.env.NODE_ENV === 'development') {
                // eslint-disable-next-line no-console
                console.warn(
                    'Button: ariaLabel is required for icon-only buttons (size="icon") for accessibility. ' +
                        'Please provide an ariaLabel prop describing the button action.'
                );
            }
        }

        return (
            <button
                ref={ref}
                className={cn(baseStyles, variants[variant], sizes[size], className)}
                disabled={disabled || isLoading}
                aria-busy={isLoading}
                aria-label={ariaLabel}
                {...props}
            >
                {isLoading ? (
                    <div
                        className="absolute inset-0 flex items-center justify-center"
                        aria-hidden="true"
                    >
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    </div>
                ) : null}
                <span className={cn(isLoading && 'invisible')}>{children}</span>
            </button>
        );
    }
);

Button.displayName = 'Button';
