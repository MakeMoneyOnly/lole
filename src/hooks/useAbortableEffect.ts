import { useEffect, useRef, useCallback } from 'react';

/**
 * A hook that provides an abortable effect with automatic cleanup.
 * The effect receives an AbortSignal that can be used to cancel fetch requests.
 *
 * @example
 * ```tsx
 * useAbortableEffect(async (signal) => {
 *   try {
 *     const response = await fetch('/api/data', { signal });
 *     const data = await response.json();
 *     if (!signal.aborted) {
 *       setData(data);
 *     }
 *   } catch (error) {
 *     if (isAbortError(error)) {
 *       return; // Request was cancelled
 *     }
 *     console.error(error);
 *   }
 * }, [dependency]);
 * ```
 */
export function useAbortableEffect(
    effect: (signal: AbortSignal) => Promise<void> | void,
    deps: React.DependencyList
) {
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // Abort any previous effect
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new AbortController for this effect
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const effectResult = effect(signal);

        return () => {
            // Abort on cleanup
            abortControllerRef.current?.abort();

            // Handle any pending promise rejections from aborted requests
            if (effectResult instanceof Promise) {
                effectResult.catch(() => {
                    // Silently catch errors from aborted requests
                });
            }
        };
    }, deps);
}

/**
 * A hook that creates an AbortController that is automatically aborted on unmount.
 * Useful for manual fetch management in useCallback functions.
 *
 * @example
 * ```tsx
 * const { signal, abort } = useAbortController();
 *
 * const fetchData = useCallback(async () => {
 *   try {
 *     const response = await fetch('/api/data', { signal });
 *     const data = await response.json();
 *     setData(data);
 *   } catch (error) {
 *     if (isAbortError(error)) return;
 *     console.error(error);
 *   }
 * }, [signal]);
 * ```
 */
export function useAbortController(): React.JSX.Element {
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    const getSignal = useCallback(() => {
        // Create new controller if none exists or previous was aborted
        if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
            abortControllerRef.current = new AbortController();
        }
        return abortControllerRef.current.signal;
    }, []);

    const abort = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
    }, []);

    return { getSignal, abort };
}
