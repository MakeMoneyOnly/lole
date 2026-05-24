'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { AppLocale, DEFAULT_APP_LOCALE, normalizeLocale } from '@/lib/i18n/locale';

export function useAppLocale(): AppLocale {
    const searchParams = useSearchParams();

    return useMemo(() => {
        const queryLocale = normalizeLocale(searchParams.get('lang'));
        if (queryLocale !== DEFAULT_APP_LOCALE) return queryLocale;

        if (typeof window !== 'undefined') {
            const stored = normalizeLocale(window.localStorage.getItem('lole:locale'));
            if (stored !== DEFAULT_APP_LOCALE) {
                return stored;
            }

            return normalizeLocale(window.navigator.language);
        }

        return DEFAULT_APP_LOCALE;
    }, [searchParams]);
}
