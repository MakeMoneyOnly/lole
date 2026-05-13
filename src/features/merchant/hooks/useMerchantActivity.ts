'use client';

import { useEffect, useState } from 'react';

export type ActivityType = 'order' | 'kitchen' | 'staff' | 'request';

export interface ActivityItem {
    id: string;
    type: ActivityType;
    user: string;
    action: string;
    target: string;
    time: string;
    timestamp: Date;
    avatar?: string;
    message?: string;
    hasMessage?: boolean;
    hasFile?: boolean;
    fileName?: string;
    fileSize?: string;
}

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

                // Transform orders to activities
                const orderActivities: ActivityItem[] = (data.orders || []).map(
                    (order: Record<string, unknown>) => ({
                        id: `order-${order.id}`,
                        type: 'order' as ActivityType,
                        user: `Order ${(order.order_number as string)?.startsWith('ORD-') ? (order.order_number as string).split('-').slice(1).join('-') : `#${order.order_number}`}`,
                        action: 'placed for',
                        target: `Table ${order.table_number}`,
                        time: new Date(order.created_at as string).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                        }),
                        timestamp: new Date(order.created_at as string),
                        hasMessage: !!order.notes,
                        message: order.notes ? `Note: '${order.notes}'` : undefined,
                        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Order${order.id}`,
                    })
                );

                // Transform requests to activities
                const requestActivities: ActivityItem[] = (data.requests || []).map(
                    (req: Record<string, unknown>) => ({
                        id: `req-${req.id}`,
                        type: 'request' as ActivityType,
                        user: `Table ${req.table_number}`,
                        action: 'requested',
                        target:
                            req.request_type === 'waiter'
                                ? 'Waiter Assistance'
                                : req.request_type === 'bill'
                                  ? 'Bill'
                                  : (req.request_type as string),
                        time: new Date(req.created_at as string).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                        }),
                        timestamp: new Date(req.created_at as string),
                        hasMessage: false,
                        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Req${req.id}`,
                    })
                );

                // Combine and sort
                const combined = [...orderActivities, ...requestActivities].sort(
                    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
                );

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

            // Re-process the data (same logic as above)
            const orderActivities: ActivityItem[] = (data.orders || []).map(
                (order: Record<string, unknown>) => ({
                    id: `order-${order.id}`,
                    type: 'order' as ActivityType,
                    user: `Order ${(order.order_number as string)?.startsWith('ORD-') ? (order.order_number as string).split('-').slice(1).join('-') : `#${order.order_number}`}`,
                    action: 'placed for',
                    target: `Table ${order.table_number}`,
                    time: new Date(order.created_at as string).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                    }),
                    timestamp: new Date(order.created_at as string),
                    hasMessage: !!order.notes,
                    message: order.notes ? `Note: '${order.notes}'` : undefined,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Order${order.id}`,
                })
            );

            const requestActivities: ActivityItem[] = (data.requests || []).map(
                (req: Record<string, unknown>) => ({
                    id: `req-${req.id}`,
                    type: 'request' as ActivityType,
                    user: `Table ${req.table_number}`,
                    action: 'requested',
                    target:
                        req.request_type === 'waiter'
                            ? 'Waiter Assistance'
                            : req.request_type === 'bill'
                              ? 'Bill'
                              : req.request_type,
                    time: new Date(req.created_at as string).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                    }),
                    timestamp: new Date(req.created_at as string),
                    hasMessage: false,
                    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Req${req.id}`,
                })
            );

            const combined = [...orderActivities, ...requestActivities].sort(
                (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
            );

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
