import { Suspense } from 'react';
import { CartProvider } from '@/context/CartContext';
import { createClient } from '@/lib/supabase/server';
import { MenuClientContent } from './menu-client';
import type { Metadata } from 'next';
import { generateRestaurantMetadata } from '@/lib/seo';
import { logger } from '@/lib/logger';

/**
 * Dynamic metadata for SEO - fetches restaurant information based on slug
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
                title: 'Restaurant Menu | lole',
                description: 'Order food online from the best restaurants in Addis Ababa',
            };
        }

        return generateRestaurantMetadata({
            name: restaurant.name,
            description: restaurant.description,
            logoUrl: restaurant.logo_url,
            slug: restaurant.slug,
            path: 'menu',
        });
    } catch (error) {
        logger.error('Error generating metadata', error);
        return {
            title: 'Restaurant Menu | lole',
            description: 'Order food online from the best restaurants in Addis Ababa',
        };
    }
}

/**
 * Default export - Server Component that renders the client menu content
 */
export default async function MenuPage(): Promise<React.ReactElement> {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen w-full bg-[var(--background)] text-white">
                    {/* Fallback space matches main structure to avoid jar */}
                </div>
            }
        >
            <CartProvider>
                <MenuClientContent />
            </CartProvider>
        </Suspense>
    );
}
