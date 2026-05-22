/**
 * Web Vitals Initializer Component
 *
 * Initializes web vitals tracking on the client side.
 * Should be mounted at the root level to track performance across the entire application.
 */

'use client';

import { useEffect } from 'react';
import {
    observeWebVitals,
    disconnectObservers,
    reportWebVital,
} from '@/lib/monitoring/webVitalsTracker';

export function WebVitalsInitializer(): React.ReactNode {
    useEffect(() => {
        observeWebVitals(metric => {
            if (process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT) {
                reportWebVital(
                    {
                        name: metric.name,
                        value: metric.value,
                        delta: metric.delta,
                        id: metric.id,
                    },
                    process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT
                );
            }
        });

        return () => {
            disconnectObservers();
        };
    }, []);

    return null;
}
