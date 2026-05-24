/**
 * SEO Metadata Utilities for lole Restaurant OS
 *
 * Provides reusable functions for generating consistent metadata across pages.
 * Supports i18n (English/Amharic) and Open Graph/Twitter cards.
 */

import type { Metadata } from 'next';

/**
 * Base site configuration
 */
export const SITE_CONFIG = {
    name: 'lole',
    description:
        "Ethiopia's leading restaurant platform - Order food online from the best restaurants in Addis Ababa",
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://lole.app',
    locale: 'en_ET',
    alternateLocale: 'am_ET',
} as const;

/**
 * Default metadata that applies to all pages
 */
export const defaultMetadata: Metadata = {
    metadataBase: new URL(SITE_CONFIG.url),
    title: {
        default: SITE_CONFIG.name,
        template: `%s | ${SITE_CONFIG.name}`,
    },
    description: SITE_CONFIG.description,
    keywords: [
        'Ethiopia',
        'Addis Ababa',
        'restaurant',
        'food delivery',
        'online ordering',
        'Ethiopian food',
        'lole',
        'ምግብ ቤት',
        'መጋበሻ',
    ],
    authors: [{ name: 'lole' }],
    creator: 'lole',
    publisher: 'lole',
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    openGraph: {
        type: 'website',
        locale: SITE_CONFIG.locale,
        alternateLocale: [SITE_CONFIG.alternateLocale],
        siteName: SITE_CONFIG.name,
    },
    twitter: {
        card: 'summary_large_image',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
    verification: {
        // Add verification codes when available
    },
};

/**
 * Options for generating page-specific metadata
 */
interface PageMetadataOptions {
    title: string;
    description: string;
    path?: string;
    image?: string;
    noIndex?: boolean;
    type?: 'website' | 'article' | 'product';
    publishedTime?: string;
    modifiedTime?: string;
    authors?: string[];
}

/**
 * Generates complete metadata for a page
 *
 * @param options - Page-specific metadata options
 * @returns Complete Metadata object for Next.js
 */
export function generatePageMetadata(options: PageMetadataOptions): Metadata {
    const {
        title,
        description,
        path = '',
        image,
        noIndex = false,
        type = 'website',
        publishedTime,
        modifiedTime,
        authors,
    } = options;

    const url = `${SITE_CONFIG.url}${path}`;
    const imageUrl = image || `${SITE_CONFIG.url}/icons/icon-512.png`;

    const openGraph = {
        type,
        locale: SITE_CONFIG.locale,
        alternateLocale: [SITE_CONFIG.alternateLocale],
        url,
        title,
        description,
        siteName: SITE_CONFIG.name,
        images: [
            {
                url: imageUrl,
                width: 1200,
                height: 630,
                alt: title,
            },
        ],
        // Add article-specific Open Graph fields
        ...(type === 'article' && {
            publishedTime,
            modifiedTime,
            authors,
        }),
    };

    const twitter = {
        card: 'summary_large_image' as const,
        title,
        description,
        images: [imageUrl],
    };

    return {
        title,
        description,
        openGraph,
        twitter,
        alternates: {
            canonical: url,
        },
        robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    };
}

/**
 * Options for restaurant-specific metadata
 */
interface RestaurantMetadataOptions {
    name: string;
    description?: string | null;
    logoUrl?: string | null;
    slug: string;
    path?: 'menu' | 'info' | 'tracker';
}

/**
 * Generates metadata for restaurant pages
 *
 * @param options - Restaurant metadata options
 * @returns Complete Metadata object for Next.js
 */
export function generateRestaurantMetadata(options: RestaurantMetadataOptions): Metadata {
    const { name, description, logoUrl, slug, path = 'menu' } = options;

    const pathMap: Record<string, string> = {
        menu: 'Menu',
        info: 'Info & Location',
        tracker: 'Order Tracker',
    };

    const title = `${name} ${pathMap[path]} | ${SITE_CONFIG.name}`;
    const defaultDescription = `Order delicious food from ${name}'s menu on lole - Ethiopia's leading restaurant platform`;
    const metaDescription = description || defaultDescription;

    return generatePageMetadata({
        title,
        description: metaDescription,
        path: `/${slug}/${path}`,
        image: logoUrl || undefined,
        type: 'website',
    });
}

/**
 * Options for order tracker metadata
 */
interface OrderTrackerMetadataOptions {
    restaurantName: string;
    orderNumber?: string | null;
    slug: string;
}

/**
 * Generates metadata for order tracker pages
 * Uses noIndex to prevent search engines from indexing order tracking pages
 *
 * @param options - Order tracker metadata options
 * @returns Complete Metadata object for Next.js
 */
export function generateOrderTrackerMetadata(options: OrderTrackerMetadataOptions): Metadata {
    const { restaurantName, orderNumber, slug } = options;

    const title = orderNumber
        ? `Order #${orderNumber} Tracker | ${restaurantName}`
        : `Order Tracker | ${restaurantName}`;

    return generatePageMetadata({
        title,
        description: `Track your order from ${restaurantName} in real-time on lole`,
        path: `/${slug}/tracker`,
        noIndex: true, // Don't index order tracking pages
    });
}

/**
 * Generates metadata for authentication pages
 * Uses noIndex to prevent search engines from indexing auth pages
 *
 * @param pageTitle - The page title (e.g., "Login", "Sign Up")
 * @param description - Page description
 * @returns Complete Metadata object for Next.js
 */
export function generateAuthMetadata(pageTitle: string, description: string): Metadata {
    return generatePageMetadata({
        title: pageTitle,
        description,
        noIndex: true, // Don't index auth pages
    });
}

/**
 * Generates metadata for dashboard/admin pages
 * Uses noIndex to prevent search engines from indexing private pages
 *
 * @param pageTitle - The page title
 * @param description - Page description
 * @returns Complete Metadata object for Next.js
 */
export function generateDashboardMetadata(pageTitle: string, description: string): Metadata {
    return generatePageMetadata({
        title: pageTitle,
        description,
        noIndex: true, // Don't index dashboard pages
    });
}

/**
 * Generates JSON-LD structured data for a restaurant
 *
 * @param restaurant - Restaurant data
 * @returns JSON-LD script content
 */
export function generateRestaurantSchema(restaurant: {
    name: string;
    description?: string | null;
    logoUrl?: string | null;
    address?: string | null;
    city?: string | null;
    phone?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    openingHours?: Record<string, { open: string; close: string; closed?: boolean }> | null;
}): string {
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: restaurant.name,
        description: restaurant.description || `${restaurant.name} - Order on lole`,
        image: restaurant.logoUrl,
        address: {
            '@type': 'PostalAddress',
            addressLocality: restaurant.city || 'Addis Ababa',
            addressCountry: 'ET',
            streetAddress: restaurant.address,
        },
        telephone: restaurant.phone,
        geo:
            restaurant.latitude && restaurant.longitude
                ? {
                      '@type': 'GeoCoordinates',
                      latitude: restaurant.latitude,
                      longitude: restaurant.longitude,
                  }
                : undefined,
        servesCuisine: ['Ethiopian', 'African'],
        priceRange: '$$',
        url: `${SITE_CONFIG.url}/${restaurant.name.toLowerCase().replace(/\s+/g, '-')}/menu`,
    };

    // Remove undefined fields
    Object.keys(schema).forEach(key => {
        if (schema[key as keyof typeof schema] === undefined) {
            delete schema[key as keyof typeof schema];
        }
    });

    return JSON.stringify(schema);
}

/**
 * Generates JSON-LD structured data for a menu item
 *
 * @param item - Menu item data
 * @param restaurantName - Restaurant name
 * @returns JSON-LD script content
 */
export function generateMenuItemSchema(
    item: {
        name: string;
        description?: string | null;
        price: number;
        image?: string | null;
    },
    restaurantName: string
): string {
    return JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'MenuItem',
        name: item.name,
        description: item.description || `${item.name} from ${restaurantName}`,
        offers: {
            '@type': 'Offer',
            price: item.price,
            priceCurrency: 'ETB',
            availability: 'https://schema.org/InStock',
        },
        image: item.image,
    });
}
