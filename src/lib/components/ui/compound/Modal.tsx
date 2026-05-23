'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Slot } from '@radix-ui/react-slot';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Modal = DialogPrimitive.Root;
Modal.displayName = 'Modal';

interface ModalTriggerProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger> {
    asChild?: boolean;
}

const ModalTrigger = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Trigger>,
    ModalTriggerProps
>(({ asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : DialogPrimitive.Trigger;
    return <Comp ref={ref} {...props} />;
});
ModalTrigger.displayName = 'Modal.Trigger';

const ModalPortal = DialogPrimitive.Portal;
ModalPortal.displayName = 'Modal.Portal';

interface ModalCloseProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close> {
    asChild?: boolean;
}

const ModalClose = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Close>,
    ModalCloseProps
>(({ asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : DialogPrimitive.Close;
    return <Comp ref={ref} {...props} />;
});
ModalClose.displayName = 'Modal.Close';

interface ModalOverlayProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> {
    asChild?: boolean;
}

const ModalOverlay = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Overlay>,
    ModalOverlayProps
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            className
        )}
        {...props}
    />
));
ModalOverlay.displayName = 'Modal.Overlay';

interface ModalContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showClose?: boolean;
}

const ModalContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    ModalContentProps
>(({ className, children, size = 'md', showClose = true, ...props }, ref) => {
    const sizes = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-4xl',
    };

    return (
        <DialogPrimitive.Portal>
            <ModalOverlay />
            <DialogPrimitive.Content
                ref={ref}
                className={cn(
                    'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] border-brand-neutral-soft/10 bg-surface-raised shadow-strong fixed top-[50%] left-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border p-6 duration-200',
                    sizes[size],
                    className
                )}
                {...props}
            >
                {children}
                {showClose && (
                    <DialogPrimitive.Close className="focus:ring-brand-accent data-[state=open]:bg-surface-muted text-text-secondary absolute top-4 right-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:pointer-events-none">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    );
});
ModalContent.displayName = 'Modal.Content';

interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    asChild?: boolean;
}

const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
    ({ className, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'div';
        return (
            <Comp
                ref={ref}
                className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
                {...props}
            />
        );
    }
);
ModalHeader.displayName = 'Modal.Header';

interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    asChild?: boolean;
}

const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
    ({ className, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'div';
        return (
            <Comp
                ref={ref}
                className={cn(
                    'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
                    className
                )}
                {...props}
            />
        );
    }
);
ModalFooter.displayName = 'Modal.Footer';

interface ModalTitleProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> {
    asChild?: boolean;
}

const ModalTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    ModalTitleProps
>(({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : DialogPrimitive.Title;
    return (
        <Comp
            ref={ref}
            className={cn('text-lg leading-none font-semibold tracking-tight', className)}
            {...props}
        />
    );
});
ModalTitle.displayName = 'Modal.Title';

interface ModalDescriptionProps extends React.ComponentPropsWithoutRef<
    typeof DialogPrimitive.Description
> {
    asChild?: boolean;
}

const ModalDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    ModalDescriptionProps
>(({ className, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : DialogPrimitive.Description;
    return <Comp ref={ref} className={cn('text-sm text-black/60', className)} {...props} />;
});
ModalDescription.displayName = 'Modal.Description';

export {
    Modal,
    ModalTrigger,
    ModalPortal,
    ModalClose,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalTitle,
    ModalDescription,
};
