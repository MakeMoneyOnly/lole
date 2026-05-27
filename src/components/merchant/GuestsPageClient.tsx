'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Crown, Repeat, Wallet } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
    CampaignBuilder,
    type CampaignRow,
    type SegmentOption,
} from '@/components/merchant/CampaignBuilder';
import { GuestDirectory, type GuestDirectoryRow } from '@/components/merchant/GuestDirectory';
import { GuestProfileDrawer } from '@/components/merchant/GuestProfileDrawer';
import {
    LoyaltyProgramBuilder,
    type LoyaltyProgramRow,
} from '@/components/merchant/LoyaltyProgramBuilder';
import { MetricCard } from '@/components/merchant/MetricCard';
import { useAppLocale } from '@/hooks/useAppLocale';
import { formatETBCurrency } from '@/lib/format/et';
import { getP2Copy } from '@/lib/i18n/p2';
import { usePageLoadGuard } from '@/hooks/usePageLoadGuard';

interface GuestsPageClientProps {
    initialData?: {
        guests: GuestDirectoryRow[];
        loyalty_programs: LoyaltyProgramRow[];
        campaigns: CampaignRow[];
        segments: SegmentOption[];
    } | null;
}

type Segment = 'all' | 'vip' | 'returning' | 'new';

type GuestDetail = {
    id: string;
    name: string | null;
    language: string;
    tags: string[];
    is_vip: boolean;
    notes: string | null;
    visit_count: number;
    lifetime_value: number;
    first_seen_at: string;
    last_seen_at: string;
};

type GuestVisit = {
    id: string;
    channel: string;
    visited_at: string;
    spend: number;
    order_id: string | null;
    metadata: Record<string, unknown>;
};

export function GuestsPageClient(_props: GuestsPageClientProps) {
    const locale = useAppLocale();
    const copy = getP2Copy(locale);
    const [guests, setGuests] = useState<GuestDirectoryRow[]>([]);
    const { loading, markLoaded } = usePageLoadGuard('guests');
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [segment, setSegment] = useState<Segment>('all');
    const [tagFilter, setTagFilter] = useState('');
    const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
    const [selectedGuest, setSelectedGuest] = useState<GuestDetail | null>(null);
    const [guestVisits, setGuestVisits] = useState<GuestVisit[]>([]);
    const [drawerLoading, setDrawerLoading] = useState(false);
    const [drawerSaving, setDrawerSaving] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);

    const [growthLoading, setGrowthLoading] = useState(true);
    const [growthError, setGrowthError] = useState<string | null>(null);
    const [loyaltyPrograms, setLoyaltyPrograms] = useState<LoyaltyProgramRow[]>([]);
    const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
    const [segments, setSegments] = useState<SegmentOption[]>([]);
    const [creatingLoyalty, setCreatingLoyalty] = useState(false);
    const [creatingCampaign, setCreatingCampaign] = useState(false);
    const [launchingCampaignId, setLaunchingCampaignId] = useState<string | null>(null);
    const [activeGrowthTab, setActiveGrowthTab] = useState<'loyalty' | 'campaigns'>('loyalty');

    // Mark as loaded on mount
    useEffect(() => {
        markLoaded();
    }, [markLoaded]);

    const fetchGuests = useCallback(async () => {
        try {
            setError(null);
            const params = new URLSearchParams();
            if (query.trim().length > 0) params.set('query', query.trim());
            if (segment !== 'all') params.set('segment', segment);
            if (tagFilter.trim().length > 0) params.set('tag', tagFilter.trim());
            params.set('limit', '100');

            const response = await fetch(`/api/guests?${params.toString()}`, {
                method: 'GET',
                cache: 'no-store',
            });
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error ?? 'Failed to load guests.');
            }
            setGuests((payload?.data?.guests ?? []) as GuestDirectoryRow[]);
        } catch (fetchError) {
            console.error(fetchError);
            setGuests([]);
            setError(fetchError instanceof Error ? fetchError.message : 'Failed to load guests.');
        } finally {
            markLoaded();
        }
    }, [query, segment, tagFilter, markLoaded]);

    const fetchGrowthData = useCallback(async () => {
        try {
            setGrowthLoading(true);
            const [programsRes, cardsRes, campaignsRes] = await Promise.all([
                fetch('/api/loyalty/programs', { method: 'GET', cache: 'no-store' }),
                fetch('/api/gift-cards', { method: 'GET', cache: 'no-store' }),
                fetch('/api/campaigns', { method: 'GET', cache: 'no-store' }),
            ]);

            const [programsPayload, cardsPayload, campaignsPayload] = await Promise.all([
                programsRes.json(),
                cardsRes.json(),
                campaignsRes.json(),
            ]);

            if (!programsRes.ok) {
                throw new Error(programsPayload?.error ?? 'Failed to load loyalty programs.');
            }
            if (!cardsRes.ok) {
                throw new Error(cardsPayload?.error ?? 'Failed to load gift cards.');
            }
            if (!campaignsRes.ok) {
                throw new Error(campaignsPayload?.error ?? 'Failed to load campaigns.');
            }

            setLoyaltyPrograms((programsPayload?.data?.programs ?? []) as LoyaltyProgramRow[]);
            setCampaigns((campaignsPayload?.data?.campaigns ?? []) as CampaignRow[]);
            setSegments(
                ((campaignsPayload?.data?.segments ?? []) as SegmentOption[]).map(item => ({
                    id: item.id,
                    name: item.name,
                }))
            );
        } catch (growthFetchError) {
            console.error(growthFetchError);
            setGrowthError(
                growthFetchError instanceof Error
                    ? growthFetchError.message
                    : 'Failed to load growth operations data.'
            );
        } finally {
            setGrowthLoading(false);
        }
    }, []);

    const fetchGuestDrawerData = useCallback(async (guestId: string) => {
        try {
            setDrawerLoading(true);
            const [guestRes, visitsRes] = await Promise.all([
                fetch(`/api/guests/${guestId}`, { method: 'GET', cache: 'no-store' }),
                fetch(`/api/guests/${guestId}/visits?limit=20`, {
                    method: 'GET',
                    cache: 'no-store',
                }),
            ]);

            const [guestPayload, visitsPayload] = await Promise.all([
                guestRes.json(),
                visitsRes.json(),
            ]);

            if (!guestRes.ok) {
                throw new Error(guestPayload?.error ?? 'Failed to load guest profile.');
            }
            if (!visitsRes.ok) {
                throw new Error(visitsPayload?.error ?? 'Failed to load guest visits.');
            }

            setSelectedGuest((guestPayload?.data ?? null) as GuestDetail | null);
            setGuestVisits((visitsPayload?.data?.visits ?? []) as GuestVisit[]);
        } catch (drawerError) {
            console.error(drawerError);
            toast.error(
                drawerError instanceof Error ? drawerError.message : 'Failed to load guest details.'
            );
            setSelectedGuest(null);
            setGuestVisits([]);
        } finally {
            setDrawerLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchGuests();
        }, 250);
        return () => window.clearTimeout(timer);
    }, [fetchGuests, refreshToken]);

    useEffect(() => {
        void fetchGrowthData();
    }, [fetchGrowthData, refreshToken]);

    useEffect(() => {
        if (!selectedGuestId) return;
        void fetchGuestDrawerData(selectedGuestId);
    }, [selectedGuestId, fetchGuestDrawerData, refreshToken]);

    const openGuest = async (guestId: string) => {
        setSelectedGuestId(guestId);
    };

    const closeDrawer = () => {
        setSelectedGuestId(null);
        setSelectedGuest(null);
        setGuestVisits([]);
    };

    const handleGuestSave = async (payload: {
        guestId: string;
        name?: string;
        language?: 'en' | 'am';
        tags?: string[];
        is_vip?: boolean;
        notes?: string | null;
    }) => {
        try {
            setDrawerSaving(true);
            const response = await fetch(`/api/guests/${payload.guestId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(payload.name !== undefined ? { name: payload.name } : {}),
                    ...(payload.language !== undefined ? { language: payload.language } : {}),
                    ...(payload.tags !== undefined ? { tags: payload.tags } : {}),
                    ...(payload.is_vip !== undefined ? { is_vip: payload.is_vip } : {}),
                    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
                }),
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error ?? 'Failed to save guest profile.');
            }

            toast.success('Guest profile updated.');
            setRefreshToken(value => value + 1);
        } catch (saveError) {
            toast.error(
                saveError instanceof Error ? saveError.message : 'Failed to save guest profile.'
            );
        } finally {
            setDrawerSaving(false);
        }
    };

    const handleCreateLoyaltyProgram = async (payload: {
        id?: string;
        name: string;
        status: LoyaltyProgramRow['status'];
        points_rule_json?: Record<string, unknown>;
    }) => {
        try {
            setCreatingLoyalty(true);
            const isUpdate = !!payload.id;
            const url = isUpdate ? `/api/loyalty/programs/${payload.id}` : '/api/loyalty/programs';
            const method = isUpdate ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(
                    result?.error ?? `Failed to ${isUpdate ? 'update' : 'create'} loyalty program.`
                );
            }
            toast.success(`Loyalty program ${isUpdate ? 'updated' : 'created'}.`);
            setRefreshToken(value => value + 1);
        } catch (createError) {
            toast.error(
                createError instanceof Error
                    ? createError.message
                    : `Failed to ${!!payload.id ? 'update' : 'create'} loyalty program.`
            );
        } finally {
            setCreatingLoyalty(false);
        }
    };

    const handleCreateCampaign = async (payload: {
        id?: string;
        name: string;
        channel: CampaignRow['channel'];
        segment_id?: string;
        scheduled_at?: string;
        template_json?: { content: string };
    }) => {
        try {
            setCreatingCampaign(true);
            const isUpdate = !!payload.id;
            const url = isUpdate ? `/api/campaigns/${payload.id}` : '/api/campaigns';
            const method = isUpdate ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(
                    result?.error ?? `Failed to ${isUpdate ? 'update' : 'create'} campaign.`
                );
            }
            toast.success(`Campaign ${isUpdate ? 'updated' : 'created'}.`);
            setRefreshToken(value => value + 1);
        } catch (createError) {
            toast.error(
                createError instanceof Error
                    ? createError.message
                    : `Failed to ${!!payload.id ? 'update' : 'create'} campaign.`
            );
        } finally {
            setCreatingCampaign(false);
        }
    };

    const handleLaunchCampaign = async (campaignId: string) => {
        try {
            setLaunchingCampaignId(campaignId);
            const response = await fetch(`/api/campaigns/${campaignId}/launch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result?.error ?? 'Failed to launch campaign.');
            }
            toast.success('Campaign launched.');
            setRefreshToken(value => value + 1);
        } catch (launchError) {
            toast.error(
                launchError instanceof Error ? launchError.message : 'Failed to launch campaign.'
            );
        } finally {
            setLaunchingCampaignId(null);
        }
    };

    // Management Handlers
    const handleDeleteLoyalty = async (id: string) => {
        try {
            const res = await fetch(`/api/loyalty/programs/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to delete program');
            }
            toast.success('Program removed');
            setRefreshToken(v => v + 1);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to remove program');
        }
    };

    const handleStatusChangeLoyalty = async (id: string, status: LoyaltyProgramRow['status']) => {
        try {
            const res = await fetch(`/api/loyalty/programs/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to update status');
            }
            toast.success(`Program ${status}`);
            setRefreshToken(v => v + 1);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : `Failed to ${status} program`);
        }
    };

    const handleDeleteCampaign = async (id: string) => {
        try {
            const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to delete campaign');
            }
            toast.success('Campaign removed');
            setRefreshToken(v => v + 1);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to remove campaign');
        }
    };

    const handleEdit = (type: string, _id: string) => {
        toast.success(`Opening edit mode for ${type}...`);
        // Implementation for opening edit modals would go here
    };

    const stats = useMemo(() => {
        const totalGuests = guests.length;
        const vipCount = guests.filter(guest => guest.is_vip).length;
        const returningCount = guests.filter(guest => guest.visit_count >= 2).length;
        const ltvTotal = guests.reduce((sum, guest) => sum + Number(guest.lifetime_value ?? 0), 0);
        return { totalGuests, vipCount, returningCount, ltvTotal };
    }, [guests]);

    return (
        <div className="min-h-screen space-y-8 pb-20">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="mb-2 text-4xl font-bold tracking-tight text-black">
                        {copy.guests.title}
                    </h1>
                    <p className="font-medium text-gray-500">{copy.guests.subtitle}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    icon={Users}
                    chip="TOTAL"
                    value={stats.totalGuests}
                    label="Guests in segment"
                    subLabel="Total customer profiles"
                    tone="blue"
                    progress={Math.min(20, Math.max(1, Math.round((stats.totalGuests / 100) * 20)))}
                    targetLabel="Target: 100"
                    currentLabel={`Current: ${stats.totalGuests}`}
                />
                <MetricCard
                    icon={Crown}
                    chip="VIP"
                    value={stats.vipCount}
                    label="VIP guests"
                    subLabel="High value customers"
                    tone="purple"
                    progress={Math.min(
                        20,
                        Math.max(1, Math.round((stats.vipCount / (stats.totalGuests || 1)) * 20))
                    )}
                    targetLabel={`Target: ${Math.round(stats.totalGuests * 0.2)}`}
                    currentLabel={`Current: ${stats.vipCount}`}
                />
                <MetricCard
                    icon={Repeat}
                    chip="RETURNING"
                    value={stats.returningCount}
                    label="Repeat guests"
                    subLabel="Loyal customers"
                    tone="rose"
                    progress={Math.min(
                        20,
                        Math.max(
                            1,
                            Math.round((stats.returningCount / (stats.totalGuests || 1)) * 20)
                        )
                    )}
                    targetLabel={`Target: ${Math.round(stats.totalGuests * 0.4)}`}
                    currentLabel={`Current: ${stats.returningCount}`}
                />
                <MetricCard
                    icon={Wallet}
                    chip="LTV"
                    value={formatETBCurrency(stats.ltvTotal, {
                        locale,
                        compact: true,
                    })}
                    label="Lifetime value"
                    subLabel="Total spend"
                    tone="green"
                    progress={20}
                    targetLabel="Target: -"
                    currentLabel="Lifetime"
                />
            </div>

            <section className="space-y-6">
                <div className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-black">
                            Growth operations
                        </h2>
                        <p className="text-sm font-medium text-gray-500">
                            Manage loyalty, gift cards, and marketing campaigns.
                        </p>
                    </div>

                    <div className="flex w-fit items-center gap-1 rounded-xl bg-gray-100/50 p-1">
                        {[
                            { id: 'loyalty', label: 'Loyalty program', icon: Crown },
                            { id: 'campaigns', label: 'Campaigns', icon: Repeat },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() =>
                                    setActiveGrowthTab(tab.id as 'loyalty' | 'campaigns')
                                }
                                className={cn(
                                    'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all',
                                    activeGrowthTab === tab.id
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:bg-white/50 hover:text-gray-700'
                                )}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {growthError ? (
                    <p role="alert" className="text-sm font-semibold text-amber-700">
                        {growthError}
                    </p>
                ) : null}

                <div className="min-h-[400px]">
                    {activeGrowthTab === 'loyalty' && (
                        <LoyaltyProgramBuilder
                            programs={loyaltyPrograms}
                            loading={growthLoading}
                            creating={creatingLoyalty}
                            onCreate={handleCreateLoyaltyProgram}
                            onDelete={handleDeleteLoyalty}
                            onStatusChange={handleStatusChangeLoyalty}
                            onEdit={id => handleEdit('loyalty', id)}
                            locale={locale}
                        />
                    )}
                    {activeGrowthTab === 'campaigns' && (
                        <CampaignBuilder
                            campaigns={campaigns}
                            segments={segments}
                            loading={growthLoading}
                            creating={creatingCampaign}
                            launchingId={launchingCampaignId}
                            onCreate={handleCreateCampaign}
                            onLaunch={handleLaunchCampaign}
                            onDelete={handleDeleteCampaign}
                            onEdit={id => handleEdit('campaign', id)}
                        />
                    )}
                </div>
            </section>

            <GuestDirectory
                guests={guests}
                loading={loading}
                error={error}
                query={query}
                onQueryChange={setQuery}
                segment={segment}
                onSegmentChange={setSegment}
                tagFilter={tagFilter}
                onTagFilterChange={setTagFilter}
                onOpenGuest={openGuest}
            />

            <GuestProfileDrawer
                open={selectedGuestId !== null}
                guest={selectedGuest}
                visits={guestVisits}
                loading={drawerLoading}
                saving={drawerSaving}
                onClose={closeDrawer}
                onSave={handleGuestSave}
            />
        </div>
    );
}
