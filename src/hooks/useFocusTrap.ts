/**
 * Focus Trap Hook for Accessibility
 *
 * Addresses COMPREHENSIVE_PLATFORM_AUDIT_REPORT Section 9.2
 * Traps focus within a container for modals, dialogs, and drawers
 *
 * Usage:
 * ```tsx
 * const { containerRef, activate, deactivate } = useFocusTrap({ active: true });
 *
 * return (
 *   <div ref={containerRef} role="dialog" aria-modal="true">
 *     <button>Focusable element 1</button>
 *     <button>Focusable element 2</button>
 *   </div>
 * );
 * ```
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseFocusTrapOptions {
    /** Whether the focus trap is active */
    active?: boolean;
    /** Called when focus trap is activated */
    onActivate?: () => void;
    /** Called when focus trap is deactivated */
    onDeactivate?: () => void;
    /** Whether to return focus to the trigger element on deactivate */
    returnFocusOnDeactivate?: boolean;
    /** Whether to auto-focus the first element on activation */
    autoFocus?: boolean;
    /** Initial focus element selector or element */
    initialFocus?: string | HTMLElement | null;
    /** Optional external ref to use for the container */
    containerRef?: React.RefObject<HTMLDivElement | null>;
}

interface UseFocusTrapReturn {
    containerRef: React.RefObject<HTMLDivElement | null>;
    activate: () => void;
    deactivate: () => void;
    isActive: boolean;
}

// Selector for all focusable elements
const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Get all focusable elements within a container
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        element => {
            // Check if element is visible
            const style = window.getComputedStyle(element);
            return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                element.offsetParent !== null
            );
        }
    );
}

/**
 * Hook to trap focus within a container element
 * Essential for modal dialogs and drawers for WCAG compliance
 */
export function useFocusTrap(options: UseFocusTrapOptions = {}): UseFocusTrapReturn {
    const {
        active = false,
        onActivate,
        onDeactivate,
        returnFocusOnDeactivate = true,
        autoFocus = true,
        initialFocus,
        containerRef: externalContainerRef,
    } = options;

    const internalContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = externalContainerRef || internalContainerRef;
    const triggerRef = useRef<HTMLElement | null>(null);
    const [isActive, setIsActive] = useState(active);

    /**
     * Activate the focus trap
     */
    const activate = useCallback(() => {
        // Store the currently focused element to return focus later
        triggerRef.current = document.activeElement as HTMLElement;
        setIsActive(true);
        onActivate?.();
    }, [onActivate]);

    /**
     * Deactivate the focus trap
     */
    const deactivate = useCallback(() => {
        setIsActive(false);
        onDeactivate?.();

        // Return focus to the trigger element
        if (returnFocusOnDeactivate && triggerRef.current) {
            triggerRef.current.focus();
            triggerRef.current = null;
        }
    }, [onDeactivate, returnFocusOnDeactivate]);

    /**
     * Handle Tab key to trap focus
     */
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (!isActive || event.key !== 'Tab') return;

            const container = containerRef.current;
            if (!container) return;

            const focusableElements = getFocusableElements(container);
            if (focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey) {
                // Shift + Tab: moving backwards
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab: moving forwards
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        },
        [isActive, containerRef]
    );

    /**
     * Handle Escape key to deactivate
     */
    const handleEscape = useCallback(
        (event: KeyboardEvent) => {
            if (isActive && event.key === 'Escape') {
                deactivate();
            }
        },
        [isActive, deactivate]
    );

    /**
     * Set up event listeners and auto-focus
     */
    useEffect(() => {
        if (!isActive) return;

        // Add event listeners
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keydown', handleEscape);

        const container = containerRef.current;
        // Auto-focus on activation
        if (container && autoFocus) {
            const focusableElements = getFocusableElements(container);

            if (initialFocus) {
                // Focus specific element
                const initialElement =
                    typeof initialFocus === 'string'
                        ? container.querySelector<HTMLElement>(initialFocus)
                        : initialFocus;

                if (initialElement) {
                    initialElement.focus();
                } else if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                }
            } else if (focusableElements.length > 0) {
                focusableElements[0].focus();
            }
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isActive, autoFocus, initialFocus, handleKeyDown, handleEscape, containerRef]);

    /**
     * Sync with external active state
     */
    const prevActiveRef = useRef(active);
    useEffect(() => {
        if (active !== prevActiveRef.current) {
            prevActiveRef.current = active;
            if (active) {
                activate();
            } else {
                deactivate();
            }
        }
    }, [active, activate, deactivate]);

    return {
        containerRef,
        activate,
        deactivate,
        isActive,
    };
}

export default useFocusTrap;
