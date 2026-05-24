'use client';

import { useCallback, useRef, useEffect } from 'react';

type HapticPattern = 'soft' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Cross-platform haptic feedback hook.
 *
 * - Android (Chrome): Uses the standard Navigator Vibration API
 * - iOS 18+ (Safari): Uses a hidden <input type="checkbox" switch> trick
 *   that triggers Safari's native haptic engine. This is the ONLY way to
 *   get haptic feedback on iOS web apps without a native container.
 * - iOS < 18 / unsupported: Silently no-ops (no crash, no error)
 */
export function useHaptic(): { trigger: (pattern?: HapticPattern) => void } {
    const iosHapticRef = useRef<{ input: HTMLInputElement; label: HTMLLabelElement } | null>(null);

    // Create the hidden iOS haptic elements on mount
    useEffect(() => {
        // Only create on iOS Safari
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        if (!isIOS) return;

        // Create hidden checkbox switch for iOS haptic trigger
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = '__ios_haptic_trigger';
        input.setAttribute('switch', '');
        input.style.position = 'fixed';
        input.style.top = '-9999px';
        input.style.left = '-9999px';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        input.style.width = '0';
        input.style.height = '0';
        input.tabIndex = -1;
        input.setAttribute('aria-hidden', 'true');

        const label = document.createElement('label');
        label.htmlFor = '__ios_haptic_trigger';
        label.style.position = 'fixed';
        label.style.top = '-9999px';
        label.style.left = '-9999px';
        label.style.opacity = '0';
        label.style.pointerEvents = 'none';
        label.style.width = '0';
        label.style.height = '0';
        label.setAttribute('aria-hidden', 'true');

        document.body.appendChild(input);
        document.body.appendChild(label);

        iosHapticRef.current = { input, label };

        return () => {
            document.body.removeChild(input);
            document.body.removeChild(label);
            iosHapticRef.current = null;
        };
    }, []);

    const triggerIOSHaptic = useCallback(() => {
        if (iosHapticRef.current) {
            try {
                // Clicking the LABEL (not the input) triggers Safari's native haptic
                iosHapticRef.current.label.click();
            } catch {
                // Silently fail on unsupported versions
            }
        }
    }, []);

    const trigger = useCallback(
        (pattern: HapticPattern = 'medium') => {
            const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

            if (isIOS) {
                // iOS: Use the Safari checkbox switch haptic trick (iOS 18+)
                // This provides a single light haptic tap — it's the only option on web
                triggerIOSHaptic();
            } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
                // Android / other: Use the standard Vibration API
                switch (pattern) {
                    case 'soft':
                        navigator.vibrate(20);
                        break;
                    case 'medium':
                        navigator.vibrate(40);
                        break;
                    case 'heavy':
                        navigator.vibrate(60);
                        break;
                    case 'success':
                        navigator.vibrate([30, 50, 30]);
                        break;
                    case 'warning':
                        navigator.vibrate([30, 50, 30]);
                        break;
                    case 'error':
                        navigator.vibrate([50, 100, 50, 100]);
                        break;
                    default:
                        navigator.vibrate(20);
                }
            }
            // If neither is supported, silently no-op
        },
        [triggerIOSHaptic]
    );

    return { trigger };
}
