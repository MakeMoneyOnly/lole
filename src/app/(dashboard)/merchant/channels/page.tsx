import { redirect } from 'next/navigation';
import { getChannelsPageData, resolveRestaurantId } from '@/lib/services/dashboardDataService';
import { ChannelsPageClient } from '@/components/merchant/ChannelsPageClient';

export default async function ChannelsPage(): Promise<React.JSX.Element> {
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
