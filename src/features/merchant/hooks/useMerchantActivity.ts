'use client';

import { useEffect, useState } from 'react';
import { transformActivityData } from '../utils/transformActivity';
import { ActivityItem, ActivityType } from '../types';

export type { ActivityType, ActivityItem };

export function useMerchantActivity() {
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

        async function fetchData() {
            try {
                if (!mounted) return;
                setLoading(true);

                console.warn('[Hook] Fetching merchant activity...');
                const response = await fetch('/api/v1/merchant/core/activity');

                console.warn('[Hook] Response status:', response.status);

                if (!response.ok) {
                    if (response.status === 401 || response.status === 404) {
                        // Silent fail for unauthorized/guest users so it doesn't pollute console
                        if (mounted) setLoading(false);
                        return;
                    }
                    console.error('[Hook] API Error. Status:', response.status);
                    return;
                }

                const data = await response.json();
                console.warn('[Hook] Received data:', {
                    orderCount: data.orders?.length || 0,
                    requestCount: data.requests?.length || 0,
                    restaurant: data.restaurant,
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
                console.error('Error fetching merchant activity:', error);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        fetchData();

        return () => {
            mounted = false;
        };
    }, []);

    const broadcastMessage = async (message: string) => {
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

    const refresh = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/v1/merchant/core/activity');
            if (!response.ok) return;
            const data = await response.json();

            const combined = transformActivityData(data);
            setActivities(combined);
        } catch (error) {
            console.error('Error refreshing activity:', error);
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
