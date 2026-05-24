import { FOOD_ITEMS } from '@/lib/constants';
import { FoodItem } from '@/types';
import { unstable_cache } from 'next/cache';

/**
 * Fetches food items. In a real application, this would fetch from Supabase.
 * We use Next.js unstable_cache to ensure the data is cached on the server.
 */
export const getMenu = unstable_cache(
    async (): Promise<FoodItem[]> => {
        // Simulate a database delay
        // await new Promise(resolve => setTimeout(resolve, 100));

        // Return the hardcoded items for now, which will be cached
        return FOOD_ITEMS;
    },
    ['menu-items'], // cache key
    {
        revalidate: 3600, // revalidate every hour
        tags: ['menu'], // tag for manual revalidation
    }
);

/**
 * Fetches a single food item by ID.
 */
export const getFoodItem = unstable_cache(
    async (id: string): Promise<FoodItem | undefined> => {
        return FOOD_ITEMS.find(item => item.id === id);
    },
    ['food-item'],
    {
        revalidate: 3600,
        tags: ['menu'],
    }
);
