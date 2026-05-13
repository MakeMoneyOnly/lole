import { Metadata } from 'next';
import OfflineContent from '@/components/shared/offline/OfflineContent';

export const metadata: Metadata = {
    title: 'Offline - lole',
    description: 'You appear to be offline. Some features may be limited.',
};

/**
 * Offline Fallback Page
 *
 * Displayed when the user is offline and tries to access a non-cached page.
 * Part of PWA offline-first implementation.
 */
export default function OfflinePage() {
    return <OfflineContent />;
}
