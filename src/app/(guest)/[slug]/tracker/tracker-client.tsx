'use client';

/**
 * Live Guest Order Tracker — /[slug]/tracker
 *
 * Shows real-time prep status of each item after a guest places an order.
 * Accessed from the success screen or via a deep-link: /<slug>/tracker?order_id=...&table=...&_sig=...&_exp=...
 * Polls /api/v1/guest-portal/track every 8 seconds and subscribes to Supabase Realtime for instant updates.
 */

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
    ChefHat,
    Clock,
    CheckCircle2,
    FlameKindling,
    PackageCheck,
    ArrowLeft,
    RefreshCw,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type KdsStatus = 'queued' | 'in_progress' | 'on_hold' | 'ready' | 'recalled';

interface KdsItem {
    id: string;
    name: string;
    quantity: number;
    station: string;
    status: KdsStatus;
    notes?: string | null;
    modifiers?: string[] | null;
    started_at?: string | null;
    ready_at?: string | null;
}

interface OrderSummary {
    id: string;
    order_number: string;
    table_number: string;
    status: string;
    created_at: string;
    total_price: number;
}

// ── Status step config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
    KdsStatus,
    { label: string; color: string; bg: string; borderColor: string; icon: React.ReactNode }
> = {
    queued: {
        label: 'Queued',
        color: 'text-slate-500',
        bg: 'bg-slate-100',
        borderColor: 'border-slate-200',
        icon: <Clock size={16} />,
    },
    in_progress: {
        label: 'Being prepared',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: <FlameKindling size={16} />,
    },
    on_hold: {
        label: 'On hold',
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: <PauseCircleIcon size={16} />,
    },
    ready: {
        label: 'Ready',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        icon: <CheckCircle2 size={16} />,
    },
    recalled: {
        label: 'Recalled',
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        borderColor: 'border-purple-200',
        icon: <RefreshCw size={16} />,
    },
};

function PauseCircleIcon({ size }: { size: number }): React.JSX.Element {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="10" y1="15" x2="10" y2="9" />
            <line x1="14" y1="15" x2="14" y2="9" />
        </svg>
    );
}

// ── Tracker Content ────────────────────────────────────────────────────────────

function TrackerContent(): React.JSX.Element {
    const params = useParams<{ slug: string }>();
    const searchParams = useSearchParams();
    const slug = params.slug;

    const orderId = searchParams.get('order_id');
    const tableNumber = searchParams.get('table');
    const signature = searchParams.get('sig') ?? searchParams.get('_sig');
    const expiresAt = searchParams.get('exp') ?? searchParams.get('_exp');

    const [items, setItems] = useState<KdsItem[]>([]);
    const [order, setOrder] = useState<OrderSummary | null>(null);
    const [restaurantName, setRestaurantName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const supabase = createClient();
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    // Fetch initial data
    useEffect(() => {
        async function fetchOrderData(): Promise<void> {
            if (!orderId || !tableNumber || !signature || !expiresAt) {
                setError('Incomplete tracking parameters');
                setLoading(false);
                return;
            }

            try {
                // Fetch restaurant name (publicly accessible)
                const { data: restaurant } = await supabase
                    .from('restaurants')
                    .select('name')
                    .eq('slug', slug)
                    .single();

                if (restaurant) {
                    setRestaurantName(restaurant.name);
                }

                // Fetch live order status via the secure V1 endpoint
                const url = new URL('/api/v1/guest-portal/track', window.location.origin);
                url.searchParams.set('slug', slug);
                url.searchParams.set('order_id', orderId);
                url.searchParams.set('table', tableNumber);
                url.searchParams.set('sig', signature);
                url.searchParams.set('exp', expiresAt);

                const response = await fetch(url.toString());
                const payload = await response.json();

                if (!response.ok) {
                    throw new Error(payload.error || 'Failed to load order status');
                }

                const { order: orderData, items: kdsItems } = payload.data;
                setOrder(orderData);
                setItems(kdsItems);
                setLastRefresh(new Date());
            } catch (err) {
                logger.error('Error fetching order data', err);
                setError(err instanceof Error ? err.message : 'Failed to load order status');
            } finally {
                setLoading(false);
            }
        }

        fetchOrderData();
    }, [orderId, tableNumber, signature, expiresAt, slug, supabase]);

    // Subscribe to realtime updates
    useEffect(() => {
        if (!orderId) return;

        // Still listen to kds_order_items for instant UI updates if possible
        channelRef.current = supabase
            .channel(`order-tracker:${orderId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'kds_order_items',
                    filter: `order_id=eq.${orderId}`,
                },
                (payload: { new: unknown }) => {
                    const updatedItem = payload.new as KdsItem & { id: string };
                    setItems(prev =>
                        prev.map(item =>
                            item.id === updatedItem.id
                                ? {
                                      ...item,
                                      status: updatedItem.status,
                                      started_at: updatedItem.started_at,
                                      ready_at: updatedItem.ready_at,
                                  }
                                : item
                        )
                    );
                    setLastRefresh(new Date());
                }
            )
            .subscribe();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [orderId, supabase]);

    // Poll for updates every 8 seconds via the secure V1 endpoint
    useEffect(() => {
        const interval = setInterval(async () => {
            if (!orderId || !tableNumber || !signature || !expiresAt) return;

            try {
                const url = new URL('/api/v1/guest-portal/track', window.location.origin);
                url.searchParams.set('slug', slug);
                url.searchParams.set('order_id', orderId);
                url.searchParams.set('table', tableNumber);
                url.searchParams.set('sig', signature);
                url.searchParams.set('exp', expiresAt);

                const response = await fetch(url.toString());
                const payload = await response.json();

                if (response.ok && payload.data) {
                    setOrder(payload.data.order);
                    setItems(payload.data.items);
                    setLastRefresh(new Date());
                }
            } catch (error) {
                logger.warn('Poll failed', { error });
            }
        }, 8000);

        return () => clearInterval(interval);
    }, [orderId, tableNumber, signature, expiresAt, slug]);

    // Group items by status
    const itemsByStatus = useMemo(() => {
        const grouped: Record<KdsStatus, KdsItem[]> = {
            queued: [],
            in_progress: [],
            on_hold: [],
            ready: [],
            recalled: [],
        };

        for (const item of items) {
            grouped[item.status].push(item);
        }

        return grouped;
    }, [items]);

    const allReady = items.length > 0 && items.every(item => item.status === 'ready');

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-slate-50">
                <ChefHat className="h-10 w-10 animate-pulse text-slate-300" />
            </main>
        );
    }

    if (error) {
        return (
            <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
                <div className="rounded-xl bg-red-50 p-6 text-center">
                    <p className="text-red-600">{error}</p>
                    <Link
                        href={`/${slug}/menu`}
                        className="bg-brand-500 hover:bg-brand-600 mt-4 inline-block rounded-lg px-4 py-2 text-white"
                    >
                        Back to Menu
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-6">
            <div className="mx-auto max-w-lg">
                {/* Header */}
                <div className="mb-6 flex items-center gap-3">
                    <Link
                        href={`/${slug}/menu`}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
                    >
                        <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">
                            {restaurantName || 'Order Tracker'}
                        </h1>
                        {order?.order_number && (
                            <p className="text-sm text-slate-500">Order #{order.order_number}</p>
                        )}
                    </div>
                </div>

                {/* All ready banner */}
                {allReady && (
                    <div className="card-shadow rounded-4xl border border-emerald-100 bg-emerald-50 p-6 text-center md:p-8">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                            <PackageCheck className="h-8 w-8 text-emerald-600" />
                        </div>
                        <h2 className="text-2xl font-bold tracking-tight text-emerald-900">
                            Your food is ready!
                        </h2>
                        <p className="mt-2 text-base font-medium text-emerald-700/80">
                            Your waiter will bring it to your table shortly.
                        </p>
                    </div>
                )}

                {/* Items by status */}
                <div className="space-y-4">
                    {(['in_progress', 'queued', 'on_hold', 'ready'] as KdsStatus[]).map(status => {
                        const statusItems = itemsByStatus[status];
                        if (statusItems.length === 0) return null;

                        const config = STATUS_CONFIG[status];

                        return (
                            <div key={status} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${config.color}`}>
                                        {config.icon}
                                        <span className="ml-1">{config.label}</span>
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        ({statusItems.length})
                                    </span>
                                </div>

                                {statusItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={`rounded-xl border ${config.borderColor} ${config.bg} p-4`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-medium text-slate-900">
                                                    {item.quantity}× {item.name}
                                                </p>
                                                {item.modifiers && item.modifiers.length > 0 && (
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {item.modifiers.join(', ')}
                                                    </p>
                                                )}
                                                {item.notes && (
                                                    <p className="mt-1 text-xs text-slate-400 italic">
                                                        "{item.notes}"
                                                    </p>
                                                )}
                                            </div>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
                                            >
                                                {config.label}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>

                {/* Last updated */}
                <p className="pt-4 text-center text-xs font-medium text-slate-400">
                    Last updated{' '}
                    {lastRefresh.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    })}{' '}
                    · Auto-refreshes every 8s
                </p>
            </div>
        </main>
    );
}

export default function TrackerClient(): React.JSX.Element {
    return (
        <Suspense
            fallback={
                <main className="flex min-h-screen items-center justify-center bg-slate-50">
                    <ChefHat className="h-10 w-10 animate-pulse text-slate-300" />
                </main>
            }
        >
            <TrackerContent />
        </Suspense>
    );
}
