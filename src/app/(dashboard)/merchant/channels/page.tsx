import { redirect } from 'next/navigation';
import { getChannelsPageData, resolveRestaurantId } from '@/lib/services/dashboardDataService';
import { ChannelsPageClient } from '@/components/merchant/ChannelsPageClient';

// Force dynamic rendering - channel data changes frequently
export const dynamic = 'force-dynamic';

// Revalidate every 0 seconds (always fresh)
export const revalidate = 0;

export default async function ChannelsPage() {
    // Check authentication and restaurant context
    const restaurantId = await resolveRestaurantId();

    if (!restaurantId) {
        redirect('/auth/signin?error=no_restaurant');
    }

    // Fetch initial data on the server
    const initialData = await getChannelsPageData();

    // Pass server-fetched data to Client Component
    return <ChannelsPageClient initialData={initialData as unknown as Record<string, unknown>} />;
}
