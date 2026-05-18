import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { generateRestaurantMetadata } from '@/lib/seo';
import RestaurantInfoClient from './info-client';

/**
 * Dynamic metadata for SEO - fetches restaurant information for info page
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
            .select('id, name, description, logo_url, slug')
            .eq('slug', slug)
            .maybeSingle();

        if (error || !restaurant) {
            return {
                title: 'Restaurant Info | lole',
                description: 'View restaurant location, hours, and contact information',
            };
        }

        return generateRestaurantMetadata({
            name: restaurant.name,
            description: restaurant.description,
            logoUrl: restaurant.logo_url,
            slug: restaurant.slug,
            path: 'info',
        });
    } catch (error) {
        console.error('Error generating metadata:', error);
        return {
            title: 'Restaurant Info | lole',
            description: 'View restaurant location, hours, and contact information',
        };
    }
}

/**
 * Restaurant Info Page - Server Component wrapper
 * Displays location, hours, contact info, and about section
 */
export default function RestaurantInfoPage(): React.JSX.Element {
    return <RestaurantInfoClient />;
}
