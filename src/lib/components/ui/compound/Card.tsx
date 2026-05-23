import { HTMLAttributes, forwardRef, createContext, useContext } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

interface CardContextValue {
    variant?: 'default' | 'glass' | 'elevated' | 'flat' | 'interactive';
    padding?: 'none' | 'sm' | 'md' | 'lg';
}

const CardContext = createContext<CardContextValue>({
    variant: 'default',
    padding: 'md',
});

const useCardContext = () => {
    const context = useContext(CardContext);
    if (!context) {
        throw new Error('Card compound components must be used within a Card.Root');
    }
    return context;
};

interface CardRootProps extends HTMLAttributes<HTMLDivElement> {
    variant?: 'default' | 'glass' | 'elevated' | 'flat' | 'interactive';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    asChild?: boolean;
}

const CardRoot = forwardRef<HTMLDivElement, CardRootProps>(
    (
        { className, variant = 'default', padding = 'md', asChild = false, children, ...props },
        ref
    ) => {
        const variants = {
            default:
                'bg-surface-raised border border-brand-neutral-soft/10 shadow-soft transition-shadow duration-300',
            glass: 'backdrop-blur-xl bg-surface-overlay border border-white/20 shadow-glass',
            elevated: 'bg-surface-raised shadow-strong border border-brand-neutral-soft/10',
            flat: 'bg-surface-muted border border-brand-neutral-soft/5',
            interactive:
                'bg-surface-raised border border-brand-neutral-soft/10 shadow-soft hover:shadow-medium hover:scale-[1.02] transition-all duration-300 cursor-pointer',
        };

        const paddings = {
            none: 'p-0',
            sm: 'p-4',
            md: 'p-6',
            lg: 'p-8',
        };

        const Comp = asChild ? Slot : 'div';

        return (
            <CardContext.Provider value={{ variant, padding }}>
                <Comp
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
                </Comp>
            </CardContext.Provider>
        );
    }
);
CardRoot.displayName = 'Card.Root';

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
    asChild?: boolean;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
    ({ className, asChild = false, ...props }, ref) => {
        const { padding } = useCardContext();
        const Comp = asChild ? Slot : 'div';
        const pbClass = padding === 'none' ? 'pb-0' : padding === 'sm' ? 'pb-2' : 'pb-4';

        return (
            <Comp
                ref={ref}
                className={cn('flex flex-col space-y-1.5', pbClass, className)}
                {...props}
            />
        );
    }
);
CardHeader.displayName = 'Card.Header';

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
    asChild?: boolean;
}

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
    ({ className, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'h3';
        return (
            <Comp
                ref={ref}
                className={cn(
                    'text-text-primary text-lg leading-none font-semibold tracking-tight',
                    className
                )}
                {...props}
            />
        );
    }
);
CardTitle.displayName = 'Card.Title';

interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
    asChild?: boolean;
}

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
    ({ className, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'p';
        return (
            <Comp ref={ref} className={cn('text-text-secondary text-sm', className)} {...props} />
        );
    }
);
CardDescription.displayName = 'Card.Description';

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
    asChild?: boolean;
}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
    ({ className, asChild = false, ...props }, ref) => {
        const { padding } = useCardContext();
        const Comp = asChild ? Slot : 'div';
        const ptClass = padding === 'none' ? 'pt-0' : '';

        return <Comp ref={ref} className={cn(ptClass, className)} {...props} />;
    }
);
CardContent.displayName = 'Card.Content';

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
    asChild?: boolean;
}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
    ({ className, asChild = false, ...props }, ref) => {
        const { padding } = useCardContext();
        const Comp = asChild ? Slot : 'div';
        const ptClass = padding === 'none' ? 'pt-0' : padding === 'sm' ? 'pt-2' : 'pt-4';

        return (
            <Comp
                ref={ref}
                className={cn(
                    'border-brand-neutral-soft/10 flex items-center border-t pt-4',
                    ptClass,
                    className
                )}
                {...props}
            />
        );
    }
);
CardFooter.displayName = 'Card.Footer';

export const Card = {
    Root: CardRoot,
    Header: CardHeader,
    Title: CardTitle,
    Description: CardDescription,
    Content: CardContent,
    Footer: CardFooter,
};
