'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ChannelHealthBoard } from '@/components/merchant/ChannelHealthBoard';
import { DeliveryPartnerHub } from '@/components/merchant/DeliveryPartnerHub';
import {
    OnlineOrderingSettingsPanel,
    type OnlineOrderingSettings,
} from '@/components/merchant/OnlineOrderingSettingsPanel';
import { usePageLoadGuard } from '@/hooks/usePageLoadGuard';
import { useRole } from '@/hooks/useRole';

interface ChannelsPageClientProps {
    initialData?: {
        summary?: ChannelSummary;
        settings?: Record<string, unknown>;
        orders?: ExternalOrder[];
    };
}

type ChannelSummary = {
    totals: {
        delivery_partners: number;
        connected_partners: number;
        degraded_partners: number;
        external_orders_24h: number;
        external_orders_total: number;
        unacked_orders: number;
    };
    statuses: Record<string, number>;
    partners: Array<{
        id: string;
        provider: string;
        status: string;
        updated_at: string;
        last_sync_at: string | null;
    }>;
};

type ExternalOrder = {
    id: string;
    provider: string;
    provider_order_id: string;
    source_channel: string;
    normalized_status: string;
    total_amount: number;
    currency: string;
    payload_json: Record<string, unknown>;
    acked_at: string | null;
    created_at: string;
    updated_at: string;
};

const defaultSettings: OnlineOrderingSettings = {
    enabled: true,
    accepts_scheduled_orders: true,
    auto_accept_orders: false,
    prep_time_minutes: 30,
    max_daily_orders: 300,
    service_hours: { start: '08:00', end: '22:00' },
    order_throttling_enabled: false,
    throttle_limit_per_15m: 40,
};

export function ChannelsPageClient(_props: ChannelsPageClientProps) {
    const { loading, markLoaded } = usePageLoadGuard('channels');
    const [error, setError] = useState<string | null>(null);

    const [summary, setSummary] = useState<ChannelSummary | null>(null);
    const [orders, setOrders] = useState<ExternalOrder[]>([]);
    const [settings, setSettings] = useState<OnlineOrderingSettings>(defaultSettings);
    const [settingsSaving, setSettingsSaving] = useState(false);

    const { restaurantId: _restaurantId } = useRole(null);
    const [restaurantSlug, setRestaurantSlug] = useState<string | null>(null);

    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState(0);

    // Mark as loaded on mount
    useEffect(() => {
        markLoaded();
    }, [markLoaded]);

    const loadAll = useCallback(async () => {
        try {
            setError(null);
            setSettingsError(null);

            const [summaryRes, settingsRes, ordersRes] = await Promise.all([
                fetch('/api/channels/summary', { method: 'GET', cache: 'no-store' }),
                fetch('/api/channels/online-ordering/settings', {
                    method: 'GET',
                    cache: 'no-store',
                }),
                fetch('/api/channels/delivery/orders?limit=100', {
                    method: 'GET',
                    cache: 'no-store',
                }),
            ]);

            const [summaryPayload, settingsPayload, ordersPayload] = await Promise.all([
                summaryRes.json(),
                settingsRes.json(),
                ordersRes.json(),
            ]);

            if (!summaryRes.ok) {
                throw new Error(summaryPayload?.error ?? 'Failed to load channel summary.');
            }
            if (!settingsRes.ok) {
                throw new Error(
                    settingsPayload?.error ?? 'Failed to load online ordering settings.'
                );
            }
            if (!ordersRes.ok) {
                console.warn(ordersPayload?.error ?? 'Failed to load delivery orders.');
            } else {
                setOrders((ordersPayload?.data?.orders ?? []) as ExternalOrder[]);
            }

            setSummary((summaryPayload?.data ?? null) as ChannelSummary | null);
            const settingsData = settingsPayload?.data ?? {};
            if (settingsData.slug) {
                setRestaurantSlug(settingsData.slug);
            }
            delete settingsData.slug;
            setSettings({ ...defaultSettings, ...settingsData });
        } catch (loadError) {
            console.error(loadError);
            setError(
                loadError instanceof Error ? loadError.message : 'Failed to load channels data.'
            );
            setSummary(null);
            setOrders([]);
        } finally {
            markLoaded();
        }
    }, [markLoaded]);

    useEffect(() => {
        void loadAll();
    }, [loadAll, refreshToken]);

    const saveSettings = async () => {
        try {
            setSettingsSaving(true);
            setSettingsError(null);
            const response = await fetch('/api/channels/online-ordering/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to save online ordering settings.');
            }
            setSettings({ ...defaultSettings, ...(payload?.data ?? {}) });
            toast.success('Online ordering settings updated.');
        } catch (saveError) {
            const message =
                saveError instanceof Error
                    ? saveError.message
                    : 'Failed to save online ordering settings.';
            setSettingsError(message);
            toast.error(message);
        } finally {
            setSettingsSaving(false);
        }
    };

    const connectPartner = async (
        provider: 'beu' | 'deliver_addis' | 'zmall' | 'esoora' | 'custom_local',
        displayName?: string
    ) => {
        try {
            setConnecting(true);
            const response = await fetch('/api/channels/delivery/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider,
                    ...(displayName ? { display_name: displayName } : {}),
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to connect delivery partner.');
            }
            toast.success('Delivery partner connected.');
            setRefreshToken(value => value + 1);
        } catch (connectError) {
            toast.error(
                connectError instanceof Error
                    ? connectError.message
                    : 'Failed to connect delivery partner.'
            );
        } finally {
            setConnecting(false);
        }
    };

    const acknowledgeOrder = async (externalOrderId: string) => {
        try {
            setAcknowledgingId(externalOrderId);
            const response = await fetch(`/api/channels/delivery/orders/${externalOrderId}/ack`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to acknowledge order.');
            }
            toast.success('External order acknowledged.');
            setRefreshToken(value => value + 1);
        } catch (ackError) {
            toast.error(
                ackError instanceof Error ? ackError.message : 'Failed to acknowledge order.'
            );
        } finally {
            setAcknowledgingId(null);
        }
    };

    return (
        <div className="min-h-screen space-y-6 pb-20">
            <div>
                <h1 className="mb-2 text-4xl font-bold tracking-tight text-black">Channels</h1>
                <p className="font-medium text-gray-500">
                    Online ordering settings and delivery integration operations.
                </p>
            </div>

            {error && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                    {error}
                </div>
            )}

            <ChannelHealthBoard loading={loading} summary={summary} error={null} />

            <OnlineOrderingSettingsPanel
                loading={loading}
                saving={settingsSaving}
                error={settingsError}
                settings={settings}
                restaurantSlug={restaurantSlug}
                onChange={setSettings}
                onSave={saveSettings}
            />

            <DeliveryPartnerHub
                loading={loading}
                partners={summary?.partners ?? []}
                orders={orders}
                connecting={connecting}
                acknowledgingId={acknowledgingId}
                onConnect={connectPartner}
                onAcknowledge={acknowledgeOrder}
            />
        </div>
    );
}
