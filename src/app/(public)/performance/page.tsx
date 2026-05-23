/**
 * Web Vitals Performance Dashboard Page
 *
 * Displays Core Web Vitals metrics for monitoring application performance.
 * Accessible for monitoring performance across the application.
 */

import { generatePageMetadata } from '@/lib/seo';
import { WebVitalsDashboard } from '@/components/performance/WebVitalsDashboard';

export const metadata = generatePageMetadata({
    title: 'Web Vitals Performance',
    description: 'Monitor Core Web Vitals performance metrics including LCP, FID, CLS, FCP, TTFB, and INP.',
    path: '/performance',
});

export default function PerformancePage(): React.JSX.Element {
    return (
        <div className="min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Web Vitals Dashboard</h1>
                    <p className="mt-2 text-gray-600">
                        Real-time Core Web Vitals monitoring for performance optimization
                    </p>
                </header>
                <main>
                    <WebVitalsDashboard showHistory={true} />
                </main>
            </div>
        </div>
    );
}