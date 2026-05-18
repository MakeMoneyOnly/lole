'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { transformActivityData } from '../utils/transformActivity';
import { ActivityItem, ActivityType } from '../types';

export type { ActivityType, ActivityItem };

export function useMerchantActivity(): React.JSX.Element {
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Initialize from sessionStorage instantly to prevent "Hello, Restaurant" flash
    const [restaurantName, setRestaurantName] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('lole_restaurant_name') ?? 'Restaurant';
        }
        return 'Restaurant';
    });
    const [restaurantHandle, setRestaurantHandle] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('lole_restaurant_handle') ?? '@restaurant_admin';
        }
        return '@restaurant_admin';
    });

    useEffect(() => {
        let mounted = true;

        async function fetchData(): Promise<void> {
            try {
                if (!mounted) return;
                setLoading(true);

                logger.warn('Fetching merchant activity...', {
                    source: '[features/merchant/hooks/useMerchantActivity]',
                });
                const response = await fetch('/api/v1/merchant/core/activity');

                logger.warn('Response status:', {
                    status: response.status,
                    source: '[features/merchant/hooks/useMerchantActivity]',
                });

                if (!response.ok) {
                    if (response.status === 401 || response.status === 404) {
                        // Silent fail for unauthorized/guest users so it doesn't pollute console
                        if (mounted) setLoading(false);
                        return;
                    }
                    logger.error('API Error', undefined, {
                        status: response.status,
                        source: '[features/merchant/hooks/useMerchantActivity]',
                    });
                    return;
                }

                const data = await response.json();
                logger.warn('Received data', {
                    orderCount: data.orders?.length || 0,
                    requestCount: data.requests?.length || 0,
                    restaurant: data.restaurant,
                    source: '[features/merchant/hooks/useMerchantActivity]',
                });

                if (!mounted) return;

                // Set restaurant info
                if (data.restaurant) {
                    const name = data.restaurant.name as string;
                    const handle = `@${data.restaurant.slug as string}_admin`;
                    setRestaurantName(name);
                    setRestaurantHandle(handle);
                    // Persist so minimize/restore doesn't flash "Restaurant"
                    sessionStorage.setItem('lole_restaurant_name', name);
                    sessionStorage.setItem('lole_restaurant_handle', handle);
                }

                // Transform and combine activities
                const combined = transformActivityData(data);
                setActivities(combined);
            } catch (error) {
                logger.error('Error fetching merchant activity', error, {
                    source: '[features/merchant/hooks/useMerchantActivity]',
                });
            } finally {
                if (mounted) setLoading(false);
            }
        }

        fetchData();

        return () => {
            mounted = false;
        };
    }, []);

    const broadcastMessage = async (message: string): Promise<void> => {
        const newActivity: ActivityItem = {
            id: `broadcast-${Date.now()}`,
            type: 'staff',
            user: 'You',
            action: 'broadcasted',
            target: 'to All Staff',
            time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            timestamp: new Date(),
            hasMessage: true,
            message: message,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${restaurantName}`,
        };
        setActivities(prev => [newActivity, ...prev]);
        return true;
    };

    const refresh = async (): Promise<void> => {
        setLoading(true);
        try {
            const response = await fetch('/api/v1/merchant/core/activity');
            if (!response.ok) return;
            const data = await response.json();

            const combined = transformActivityData(data);
            setActivities(combined);
        } catch (error) {
            logger.error('Error refreshing activity', error, {
                source: '[features/merchant/hooks/useMerchantActivity]',
            });
        } finally {
            setLoading(false);
        }
    };

    return {
        activities,
        loading,
        restaurantName,
        restaurantHandle,
        broadcastMessage,
        refresh,
    };
}
