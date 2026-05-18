'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { MapPin, Phone, Info, Navigation } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { isAbortError } from '@/hooks/useSafeFetch';

interface LocationMapProps {
    latitude: number;
    longitude: number;
    name: string;
}

// Lazy load map component to avoid SSR issues
const LocationMap = dynamic<LocationMapProps>(
    () =>
        import('react').then(mod => ({
            default: function LocationMapFallback() {
                return null;
            },
        })),
    { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-gray-200" /> }
);

interface RestaurantInfo {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    description: string | null;
    description_am: string | null;
    latitude: number | null;
    longitude: number | null;
    opening_hours: Record<string, { open: string; close: string; closed?: boolean }> | null;
    social_links: Record<string, string> | null;
}

type TabType = 'location' | 'hours' | 'contact' | 'about';

const DAYS_OF_WEEK = [
    { key: 'monday', label: 'Monday', labelAm: 'ሰኞ' },
    { key: 'tuesday', label: 'Tuesday', labelAm: 'ማክሰኞ' },
    { key: 'wednesday', label: 'Wednesday', labelAm: 'ረቡዕ' },
    { key: 'thursday', label: 'Thursday', labelAm: 'ሐሙስ' },
    { key: 'friday', label: 'Friday', labelAm: 'ዓርብ' },
    { key: 'saturday', label: 'Saturday', labelAm: 'ቅዳሜ' },
    { key: 'sunday', label: 'Sunday', labelAm: 'እሑድ' },
];

function RestaurantInfoContent(): React.JSX.Element {
    const params = useParams<{ slug: string }>();
    const searchParams = useSearchParams();
    const slug = params.slug;
    const initialTab = (searchParams.get('tab') as TabType) || 'location';

    const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);

    const supabase = createClient();

    useEffect(() => {
        async function fetchRestaurant(): Promise<void> {
            if (!slug) return;

            setLoading(true);
            setError(null);

            try {
                const { data, error: fetchError } = await supabase
                    .from('restaurants')
                    .select(
                        `
                        id,
                        name,
                        slug,
                        logo_url,
                        address,
                        city,
                        phone,
                        email,
                        website,
                        description,
                        description_am,
                        latitude,
                        longitude,
                        opening_hours,
                        social_links
                    `
                    )
                    .eq('slug', slug)
                    .maybeSingle();

                if (fetchError) {
                    throw new Error(fetchError.message);
                }

                if (!data) {
                    throw new Error('Restaurant not found');
                }

                setRestaurant(data as RestaurantInfo);
            } catch (err) {
                if (isAbortError(err)) return;
                console.error('Error fetching restaurant:', err);
                setError(err instanceof Error ? err.message : 'Failed to load restaurant');
            } finally {
                setLoading(false);
            }
        }

        fetchRestaurant();
    }, [slug, supabase]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
                <div className="flex animate-pulse flex-col items-center gap-4">
                    <div className="h-20 w-20 rounded-xl bg-gray-300" />
                    <div className="h-6 w-48 rounded bg-gray-300" />
                </div>
            </div>
        );
    }

    if (error || !restaurant) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background)] p-4">
                <div className="rounded-xl bg-red-50 p-6 text-center">
                    <p className="text-red-600">{error || 'Restaurant not found'}</p>
                </div>
            </div>
        );
    }

    function formatTime(time: string): string {
        try {
            const [hours, minutes] = time.split(':');
            const hour = parseInt(hours, 10);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour % 12 || 12;
            return `${displayHour}:${minutes} ${ampm}`;
        } catch {
            return time;
        }
    }

    return (
        <div className="bg-surface-0 pb-safe min-h-screen">
            {/* Header */}
            <div className="from-brand-500 to-brand-700 relative h-48 bg-gradient-to-br">
                {restaurant.logo_url && (
                    <Image
                        src={restaurant.logo_url}
                        alt={restaurant.name}
                        fill
                        className="object-cover opacity-20"
                    />
                )}
                <div className="absolute right-4 bottom-4 left-4">
                    <h1 className="font-manrope text-2xl font-bold text-white drop-shadow-lg">
                        {restaurant.name}
                    </h1>
                    {restaurant.address && (
                        <p className="mt-1 flex items-center gap-1 text-sm text-white/90">
                            <MapPin size={14} />
                            {restaurant.address}
                            {restaurant.city && `, ${restaurant.city}`}
                        </p>
                    )}
                </div>
            </div>

            {/* Tab Bar */}
            <div className="sticky top-0 z-10 flex gap-2 border-b bg-white px-4 py-3">
                {(['location', 'hours', 'contact', 'about'] as TabType[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                            activeTab === tab
                                ? 'bg-brand-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Content */}
            <main className="p-4">
                {activeTab === 'location' && (
                    <div className="space-y-4">
                        <div className="rounded-xl bg-white p-4 shadow-sm">
                            {restaurant.latitude && restaurant.longitude ? (
                                <LocationMap
                                    latitude={restaurant.latitude}
                                    longitude={restaurant.longitude}
                                    name={restaurant.name}
                                />
                            ) : (
                                <div className="flex h-64 items-center justify-center rounded-xl bg-gray-100">
                                    <p className="text-gray-500">Location not available</p>
                                </div>
                            )}
                            {restaurant.address && (
                                <div className="mt-4 flex items-start gap-3">
                                    <div className="bg-brand-100 flex h-10 w-10 items-center justify-center rounded-full">
                                        <MapPin className="text-brand-600 h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {restaurant.address}
                                        </p>
                                        {restaurant.city && (
                                            <p className="text-sm text-gray-500">
                                                {restaurant.city}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'hours' && (
                    <div className="rounded-xl bg-white p-4 shadow-sm">
                        <h2 className="font-manrope mb-4 text-lg font-bold text-gray-900">
                            Opening Hours
                        </h2>
                        {restaurant.opening_hours ? (
                            <div className="space-y-3">
                                {DAYS_OF_WEEK.map(({ key, label, labelAm }) => {
                                    const hours = restaurant.opening_hours?.[key];
                                    return (
                                        <div
                                            key={key}
                                            className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0"
                                        >
                                            <div>
                                                <span className="font-medium text-gray-900">
                                                    {label}
                                                </span>
                                                <span className="ml-2 text-sm text-gray-500">
                                                    ({labelAm})
                                                </span>
                                            </div>
                                            {hours?.closed ? (
                                                <span className="text-sm text-red-500">Closed</span>
                                            ) : hours ? (
                                                <span className="text-sm text-gray-600">
                                                    {formatTime(hours.open)} -{' '}
                                                    {formatTime(hours.close)}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-gray-400">
                                                    Not specified
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-gray-500">Opening hours not available</p>
                        )}
                    </div>
                )}

                {activeTab === 'contact' && (
                    <div className="space-y-3">
                        {restaurant.phone && (
                            <div className="rounded-xl bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                                        <Phone className="h-5 w-5 text-green-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Phone</p>
                                        <a
                                            href={`tel:${restaurant.phone}`}
                                            className="hover:text-brand-600 font-medium text-gray-900"
                                        >
                                            {restaurant.phone}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                        {restaurant.email && (
                            <div className="rounded-xl bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                                        <Info className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Email</p>
                                        <a
                                            href={`mailto:${restaurant.email}`}
                                            className="hover:text-brand-600 font-medium text-gray-900"
                                        >
                                            {restaurant.email}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                        {restaurant.website && (
                            <div className="rounded-xl bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                                        <Navigation className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Website</p>
                                        <a
                                            href={restaurant.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-brand-600 font-medium text-gray-900"
                                        >
                                            {restaurant.website}
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                        {!restaurant.phone && !restaurant.email && !restaurant.website && (
                            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                                <p className="text-gray-500">Contact information not available</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'about' && (
                    <div className="space-y-6">
                        <div className="rounded-xl bg-[var(--card)] p-6 shadow-sm">
                            <h2 className="font-manrope mb-4 text-lg font-bold text-black dark:text-white">
                                About {restaurant.name}
                            </h2>

                            {restaurant.description ? (
                                <div className="space-y-4">
                                    <p className="leading-relaxed text-gray-600 dark:text-gray-300">
                                        {restaurant.description}
                                    </p>

                                    {restaurant.description_am && (
                                        <p className="mt-4 border-t border-gray-200 pt-4 text-sm leading-relaxed text-gray-500 dark:border-gray-700">
                                            {restaurant.description_am}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-gray-500">No description available</p>
                            )}
                        </div>

                        {restaurant.logo_url && (
                            <div className="rounded-xl bg-[var(--card)] p-6 text-center shadow-sm">
                                <Image
                                    src={restaurant.logo_url}
                                    alt={restaurant.name}
                                    width={120}
                                    height={120}
                                    className="mx-auto rounded-xl object-cover"
                                />
                                <p className="mt-4 text-sm text-gray-500">
                                    Thank you for dining with us!
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

export default function RestaurantInfoClient(): React.JSX.Element {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
                    <div className="flex animate-pulse flex-col items-center gap-4">
                        <div className="h-20 w-20 rounded-xl bg-gray-300" />
                        <div className="h-6 w-48 rounded bg-gray-300" />
                    </div>
                </div>
            }
        >
            <RestaurantInfoContent />
        </Suspense>
    );
}
