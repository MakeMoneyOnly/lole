'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Modal = DialogPrimitive.Root;

const ModalTrigger = DialogPrimitive.Trigger;

const ModalPortal = DialogPrimitive.Portal;

const ModalClose = DialogPrimitive.Close;

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
        <ModalPortal>
            <DialogPrimitive.Overlay
                className={cn(
                    'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
                    className
                )}
            />
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
        </ModalPortal>
    );
});
ModalContent.displayName = DialogPrimitive.Content.displayName;

type ModalHeaderProps = React.HTMLAttributes<HTMLDivElement>;

const ModalHeader = ({ className, ...props }: ModalHeaderProps): React.JSX.Element => (
    <div
        className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
        {...props}
    />
);
ModalHeader.displayName = 'ModalHeader';

type ModalFooterProps = React.HTMLAttributes<HTMLDivElement>;

const ModalFooter = ({ className, ...props }: ModalFooterProps): React.JSX.Element => (
    <div
        className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
        {...props}
    />
);
ModalFooter.displayName = 'ModalFooter';

type ModalTitleProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>;

const ModalTitle = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Title>,
    ModalTitleProps
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title
        ref={ref}
        className={cn('text-lg leading-none font-semibold tracking-tight', className)}
        {...props}
    />
));
ModalTitle.displayName = DialogPrimitive.Title.displayName;

type ModalDescriptionProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>;

const ModalDescription = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Description>,
    ModalDescriptionProps
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description
        ref={ref}
        className={cn('text-sm text-black/60', className)}
        {...props}
    />
));
ModalDescription.displayName = DialogPrimitive.Description.displayName;

export {
    Modal,
    ModalPortal,
    ModalTrigger,
    ModalClose,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalTitle,
    ModalDescription,
};
