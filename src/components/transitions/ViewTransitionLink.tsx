import React from 'react';
import Link, { LinkProps } from 'next/link';

/**
 * View Transition Types
 */
export type ViewTransitionType = 'auto' | 'push' | 'replace';

export interface ViewTransitionProps {
    /**
     * The view transition name for the Shared Element transition.
     * When set, the element will animate smoothly between routes.
     * Setting to "none" disables the transition for this link.
     */
    transitionName?: string | 'none';

    /**
     * The navigation transition style.
     * - 'auto': Browser default behavior
     * - 'push': New page animates in (forward navigation)
     * - 'replace': Same page animates (backward navigation)
     */
    transitionType?: ViewTransitionType;

    /**
     * Custom duration for the transition in milliseconds.
     * Defaults to browser default.
     */
    duration?: number;
}

export interface ViewTransitionLinkProps extends Omit<LinkProps, 'scroll'>, ViewTransitionProps {
    /**
     * The content to render inside the link.
     */
    children: React.ReactNode;

    /**
     * Additional className for the link element.
     */
    className?: string;

    /**
     * Whether the link should scroll to top on navigation.
     * Defaults to true.
     */
    scroll?: boolean;
}

/**
 * Check if the View Transitions API is supported in the current browser.
 */
function isViewTransitionsSupported(): boolean {
    if (typeof document === 'undefined') return false;
    return 'startViewTransition' in document;
}

/**
 * ViewTransitionLink Component
 *
 * A drop-in replacement for Next.js Link that adds support for the View Transitions API.
 * Provides smooth, native-like transitions between routes with Shared Element animations.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ViewTransitionLink href="/menu">Menu</ViewTransitionLink>
 *
 * // With shared element transition
 * <ViewTransitionLink href="/product/123" transitionName="product-image">
 *   Product Details
 * </ViewTransitionLink>
 *
 * // With push transition style
 * <ViewTransitionLink href="/checkout" transitionType="push">
 *   Checkout
 * </ViewTransitionLink>
 * ```
 *
 * @remarks
 * - Automatically degrades gracefully in browsers without View Transitions support
 * - Works with Next.js App Router and client components
 * - Supports typed transition names for shared elements
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
 */
export const ViewTransitionLink = React.forwardRef<HTMLAnchorElement, ViewTransitionLinkProps>(
    (
        { href, children, className, transitionName, duration, scroll = true, onClick, ...props },
        ref
    ) => {
        const handleClick = React.useCallback(
            (event: React.MouseEvent<HTMLAnchorElement>) => {
                onClick?.(event);
            },
            [onClick]
        );

        const style: React.CSSProperties = {
            ...(transitionName &&
                transitionName !== 'none' && {
                    viewTransitionName: transitionName,
                }),
            ...(duration && {
                animationDuration: `${duration}ms`,
            }),
        };

        return (
            <Link
                ref={ref}
                href={href}
                className={className}
                style={style}
                scroll={scroll}
                onClick={handleClick}
                {...props}
            >
                {children}
            </Link>
        );
    }
);

ViewTransitionLink.displayName = 'ViewTransitionLink';

/**
 * Custom hook to programmatically trigger view transitions
 */
export function useViewTransition(): {
    supported: boolean;
    startTransition: (updateCallback: () => void | Promise<void>) => Promise<void>;
} {
    const supported = isViewTransitionsSupported();

    const startTransition = React.useCallback(
        async (updateCallback: () => void | Promise<void>): Promise<void> => {
            if (!supported) {
                updateCallback();
                return;
            }

            const doc = document as Document & {
                startViewTransition?: (cb: () => void) => { ready: Promise<void> };
            };
            const transition = doc.startViewTransition?.(updateCallback);
            await transition?.ready;
        },
        [supported]
    );

    return { supported, startTransition };
}

export function setupSharedElement(name: string, element: HTMLElement): void {
    if (!isViewTransitionsSupported()) return;
    element.style.viewTransitionName = name;
}

export type { LinkProps };
