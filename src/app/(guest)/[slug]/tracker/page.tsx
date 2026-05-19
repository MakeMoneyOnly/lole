import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { generateOrderTrackerMetadata } from '@/lib/seo';
import TrackerClient from './tracker-client';
import { logger } from '@/lib/logger';

/**
 * Dynamic metadata for SEO - order tracker page
 * Uses noIndex to prevent search engines from indexing order tracking pages
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;

    try {
        const supabase = await createClient();

        const { data: restaurant, error } = await supabase
            .from('restaurants')
            .select('id, name, slug')
            .eq('slug', slug)
            .maybeSingle();

        if (error || !restaurant) {
            return {
                title: 'Order Tracker | lole',
                description: 'Track your order in real-time',
                robots: { index: false, follow: false },
            };
        }

        return generateOrderTrackerMetadata({
            restaurantName: restaurant.name,
            slug: restaurant.slug,
        });
    } catch (error) {
        logger.error('Error generating metadata', error);
        return {
            title: 'Order Tracker | lole',
            description: 'Track your order in real-time',
            robots: { index: false, follow: false },
        };
    }
}

/**
 * Order Tracker Page - Server Component wrapper
 * Displays real-time order status for guests
 */
export default function TrackerPage(): React.JSX.Element {
    return <TrackerClient />;
}
