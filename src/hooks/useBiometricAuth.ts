'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    authenticateWithBiometrics,
    isBiometricAvailable,
    isBiometricTokenValid,
} from '@/lib/mobile/biometric-auth';

interface UseBiometricAuthOptions {
    enabled?: boolean;
    maxTokenAgeMs?: number;
}

interface UseBiometricAuthReturn {
    isAvailable: boolean;
    isAuthenticated: boolean;
    authenticate: (reason?: string) => Promise<boolean>;
    resetAuth: () => void;
}

export function useBiometricAuth(options: UseBiometricAuthOptions = {}): UseBiometricAuthReturn {
    const { enabled = true, maxTokenAgeMs = 4 * 60 * 60 * 1000 } = options;
    const [isAvailable, setIsAvailable] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const bioTokenRef = useRef<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        isBiometricAvailable().then(available => {
            setIsAvailable(available);
        });
    }, [enabled]);

    const authenticate = useCallback(
        async (reason = 'Verify your identity to access Lole') => {
            if (!enabled) {
                setIsAuthenticated(true);
                return true;
            }

            const result = await authenticateWithBiometrics(reason);

            if (result.success && result.token) {
                bioTokenRef.current = result.token;
                try {
                    if (typeof window !== 'undefined') {
                        window.localStorage.setItem('lole_bio_token', result.token);
                    }
                } catch {
                    // Non-critical
                }
                setIsAuthenticated(true);
                return true;
            }

            return false;
        },
        [enabled]
    );

    const resetAuth = useCallback(() => {
        bioTokenRef.current = null;
        setIsAuthenticated(false);
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('lole_bio_token');
        }
    }, []);

    useEffect(() => {
        if (!enabled || !isAvailable) {
            return;
        }

        try {
            const storedToken =
                typeof window !== 'undefined'
                    ? window.localStorage.getItem('lole_bio_token')
                    : null;

            if (storedToken && isBiometricTokenValid(storedToken, maxTokenAgeMs)) {
                bioTokenRef.current = storedToken;
                setIsAuthenticated(true);
            } else if (storedToken) {
                // Token expired, clear it
                window.localStorage?.removeItem('lole_bio_token');
            }
        } catch {
            // Non-critical
        }
    }, [enabled, isAvailable, maxTokenAgeMs]);

    return {
        isAvailable,
        isAuthenticated,
        authenticate,
        resetAuth,
    };
}
