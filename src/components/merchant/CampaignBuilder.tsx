'use client';

import { type ReactElement } from 'react';

export type CampaignRow = {
    id: string;
    name: string;
    channel: 'sms' | 'email' | 'push';
    segment_id?: string | null;
    scheduled_at?: string | null;
    created_at: string;
};

export type SegmentOption = {
    id: string;
    name: string;
};

interface CampaignBuilderProps {
    campaigns: CampaignRow[];
    segments: SegmentOption[];
    loading: boolean;
    creating: boolean;
    launchingId: string | null;
    onCreate: (payload: {
        name: string;
        channel: CampaignRow['channel'];
        segment_id?: string;
        scheduled_at?: string;
    }) => Promise<void>;
    onLaunch: (campaignId: string) => Promise<void>;
    onDelete: (campaignId: string) => Promise<void>;
    onEdit: (campaignId: string) => void;
}

export function CampaignBuilder({
    campaigns,
    segments,
    loading,
    creating: _creating,
    launchingId: _launchingId,
    onCreate: _onCreate,
    onLaunch: _onLaunch,
    onDelete: _onDelete,
    onEdit: _onEdit,
}: CampaignBuilderProps): ReactElement {
    const segmentMap = new Map(segments.map(s => [s.id, s.name]));

    return (
        <div className="space-y-4">
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-gray-50" />
                    ))}
                </div>
            ) : campaigns.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/30">
                    <p className="text-sm font-bold text-gray-500">No campaigns yet</p>
                    <p className="mt-1 text-xs font-medium text-gray-400">
                        Create your first marketing campaign.
                    </p>
                </div>
            ) : (
                <div className="no-scrollbar max-h-[400px] space-y-3 overflow-y-auto pr-2">
                    {campaigns.map(campaign => (
                        <div
                            key={campaign.id}
                            className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm transition-all hover:shadow-md"
                        >
                            <div>
                                <p className="text-md font-bold text-gray-900">{campaign.name}</p>
                                <p className="mt-1 text-xs text-gray-500">
                                    {campaign.channel.toUpperCase()}
                                    {campaign.segment_id && segmentMap.get(campaign.segment_id)
                                        ? ` • ${segmentMap.get(campaign.segment_id)}`
                                        : ''}
                                </p>
                            </div>
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600 capitalize">
                                {campaign.scheduled_at ? 'Scheduled' : 'Draft'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
