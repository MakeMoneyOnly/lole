'use client';

import { Activity, AlertTriangle, CheckCircle2, Truck } from 'lucide-react';
import { MetricCard } from '@/components/merchant/MetricCard';

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

interface ChannelHealthBoardProps {
    loading: boolean;
    summary: ChannelSummary | null;
    error: string | null;
}

export function ChannelHealthBoard({ loading, summary, error }: ChannelHealthBoardProps) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-[180px] animate-pulse rounded-4xl bg-white shadow-sm"
                    />
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800"
            >
                {error}
            </div>
        );
    }

    const totals = summary?.totals;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    icon={Truck}
                    chip="CHANNELS"
                    value={totals?.delivery_partners ?? 0}
                    label="Connected Channels"
                    subLabel="Active Integrations"
                    tone="blue"
                    progress={20}
                    targetLabel="Target: -"
                    currentLabel="Full Setup"
                />
                <MetricCard
                    icon={CheckCircle2}
                    chip="HEALTHY"
                    value={totals?.connected_partners ?? 0}
                    label="Healthy Partners"
                    subLabel="Operational Status"
                    tone="green"
                    progress={Math.min(
                        20,
                        Math.max(
                            0,
                            Math.round(
                                ((totals?.connected_partners ?? 0) /
                                    (totals?.delivery_partners || 1)) *
                                    20
                            )
                        )
                    )}
                    targetLabel={`Total: ${totals?.delivery_partners ?? 0}`}
                    currentLabel={`Online: ${totals?.connected_partners ?? 0}`}
                />
                <MetricCard
                    icon={Activity}
                    chip="24H ORDERS"
                    value={totals?.external_orders_24h ?? 0}
                    label="External Orders"
                    subLabel="Last 24 Hours"
                    tone="purple"
                    progress={Math.min(
                        20,
                        Math.max(1, Math.round(((totals?.external_orders_24h ?? 0) / 100) * 20))
                    )}
                    targetLabel="Target: 100+"
                    currentLabel="Today"
                />
                <MetricCard
                    icon={AlertTriangle}
                    chip="ACTION"
                    value={totals?.unacked_orders ?? 0}
                    label="Unacknowledged"
                    subLabel="Requires Acknowledge"
                    tone="amber"
                    progress={(totals?.unacked_orders ?? 0) > 0 ? 20 : 0}
                    targetLabel="Target: 0"
                    currentLabel="Pending"
                />
            </div>
        </div>
    );
}
