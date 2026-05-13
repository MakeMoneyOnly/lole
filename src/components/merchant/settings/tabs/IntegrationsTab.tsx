'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
    Zap,
    Link2,
    CheckCircle2,
    AlertTriangle,
    ExternalLink,
    Download,
    RefreshCw,
    Clock,
    Info,
    Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type IntegrationStatus = 'connected' | 'error' | 'pending' | 'disconnected';

interface Integration {
    id: string;
    name: string;
    description: string;
    category: string;
    status: IntegrationStatus;
    lastSync?: string;
    docsUrl: string;
}

// ─────────────────────────────────────────────
// Seed Data
// ─────────────────────────────────────────────

const INTEGRATIONS: Integration[] = [
    {
        id: 'ethswitch',
        name: 'EthSwitch P2M',
        description:
            'National interbank switch for Person-to-Merchant card payments. Enables Visa, MasterCard, and local Ethiopian bank card acceptance across all Cbe, Awash, and Dashen Pos terminals.',
        category: 'Local API Connectors',
        status: 'connected',
        lastSync: '2024-04-16T12:00:00Z',
        docsUrl: 'https://ethswitch.et',
    },
    {
        id: 'sigtas',
        name: 'Ministry of Revenue — Sigtas',
        description:
            'Automated daily tax reporting sync with the Ethiopian Tax Administration System (Sigtas). Required for Vat-registered businesses. Pushes gross sales, Vat collected, and Wht data in real-time.',
        category: 'Local API Connectors',
        status: 'pending',
        docsUrl: 'https://mor.gov.et',
    },
    {
        id: 'telebirr',
        name: 'Telebirr (Ethio Telecom)',
        description:
            "Ethiopia's largest mobile money platform. Accept Telebirr payments at Pos and online ordering. Settlement to your primary Ethiopian bank within T+1.",
        category: 'Mobile Money',
        status: 'connected',
        lastSync: '2024-04-16T11:45:00Z',
        docsUrl: 'https://telebirr.et',
    },
    {
        id: 'chapa',
        name: 'Chapa Payment Gateway',
        description:
            'Ethiopian-built payment gateway supporting ETB, USD payments via cards, bank transfers, and mobile money. Integrated with your Supabase payment sessions.',
        category: 'Payment Processing',
        status: 'connected',
        lastSync: '2024-04-16T12:05:00Z',
        docsUrl: 'https://chapa.co',
    },
    {
        id: 'fayda',
        name: 'Fayda — Nidp Identity Verification',
        description:
            'National Identity Digital Platform for verifying Ethiopian national IDs. Used for Kyc/Aml compliance during employee and control-person onboarding.',
        category: 'Identity & Compliance',
        status: 'pending',
        docsUrl: 'https://id.gov.et',
    },
    {
        id: 'erca',
        name: 'Erca e-Tax Portal',
        description:
            'Electronic Tax Receipt submission to the Ethiopian Revenue and Customs Authority. Every transaction generates a signed fiscal receipt. Failure to connect results in non-compliance penalties.',
        category: 'Tax Compliance',
        status: 'connected' as IntegrationStatus, // overridden by live fetch
        docsUrl: 'https://etax.erca.gov.et',
    },
];

const CATEGORIES = [...new Set(INTEGRATIONS.map(i => i.category))];

const INTEGRATIONS_DOCS = [
    'EthSwitch API credentials letter (from NBE)',
    'Sigtas API access authorization from MoR',
    'Telebirr merchant agreement and API key',
    'Chapa merchant onboarding documents',
    'Fayda integration Mou',
    'Erca digital signature certificate',
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; dot: string; badge: string }> = {
    connected: {
        label: 'Connected',
        dot: 'bg-green-400',
        badge: 'bg-green-50 text-green-600 border-green-100',
    },
    pending: {
        label: 'Pending Setup',
        dot: 'bg-amber-400',
        badge: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    error: { label: 'Error', dot: 'bg-red-400', badge: 'bg-red-50 text-red-500 border-red-100' },
    disconnected: {
        label: 'Disconnected',
        dot: 'bg-gray-300',
        badge: 'bg-gray-50 text-gray-400 border-gray-100',
    },
};

function DocChecklistButton({ docs }: { docs: string[] }) {
    const handleDownload = () => {
        const content = `Integrations Document Checklist\nGenerated: ${new Date().toLocaleDateString('en-ET')}\n\n${docs.map((d, i) => `${i + 1}. ☐ ${d}`).join('\n')}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'integrations-document-checklist.txt';
        a.click();
        URL.revokeObjectURL(url);
    };
    return (
        <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50"
        >
            <Download className="h-3.5 w-3.5" /> Download Document Checklist
        </button>
    );
}

function IntegrationCard({
    integration,
    onToggle,
}: {
    integration: Integration;
    onToggle: (id: string) => void;
}) {
    const { label, dot, badge } = STATUS_CONFIG[integration.status];
    const isConnected = integration.status === 'connected';

    return (
        <div
            className={cn(
                'rounded-xl border p-5 transition-all',
                isConnected
                    ? 'border-gray-100 bg-white'
                    : 'border-dashed border-gray-200 bg-gray-50/30'
            )}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                        <Link2 className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                                {integration.name}
                            </p>
                            <div
                                className={cn(
                                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
                                    badge
                                )}
                            >
                                <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
                                <span className="text-[10px] font-semibold">{label}</span>
                            </div>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-gray-400">
                            {integration.description}
                        </p>
                        {integration.lastSync && (
                            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                                <Clock className="h-3 w-3" />
                                Last sync: {new Date(integration.lastSync).toLocaleString('en-ET')}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                        onClick={() => onToggle(integration.id)}
                        className={cn(
                            'rounded-xl px-4 py-2 text-xs font-semibold transition-all',
                            isConnected
                                ? 'border border-gray-200 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-500'
                                : 'bg-gray-900 text-white hover:bg-gray-700'
                        )}
                    >
                        {isConnected ? 'Disconnect' : 'Connect'}
                    </button>
                    {isConnected && (
                        <button className="flex items-center gap-1 text-[10px] text-gray-400 transition-colors hover:text-gray-700">
                            <RefreshCw className="h-3 w-3" /> Sync now
                        </button>
                    )}
                </div>
            </div>
            <div className="mt-3 flex items-center gap-3 border-t border-gray-50 pt-3">
                <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-medium text-gray-400 transition-colors hover:text-gray-700"
                >
                    <ExternalLink className="h-3 w-3" /> Documentation
                </a>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export function IntegrationsTab() {
    const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
    const [ercaStatus, setErcaStatus] = useState<IntegrationStatus>('disconnected');
    const [ercaLastSync, setErcaLastSync] = useState<string | undefined>();

    useEffect(() => {
        const fetchErcaStatus = async () => {
            try {
                const supabase = getSupabaseClient();
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                if (!session) return;

                const { data: staff } = await supabase
                    .from('restaurant_staff')
                    .select('restaurant_id')
                    .eq('user_id', session.user.id)
                    .single();

                if (!staff?.restaurant_id) return;

                const res = await fetch(
                    `/api/v1/merchant/core/restaurants/${staff.restaurant_id}/erca-status`
                );
                if (!res.ok) return;

                const body = await res.json();
                const status = body.data?.status;

                if (status === 'healthy') setErcaStatus('connected');
                else if (status === 'warning') setErcaStatus('pending');
                else if (status === 'error') setErcaStatus('error');
                else setErcaStatus('disconnected');

                if (body.data?.last_success_at) {
                    setErcaLastSync(body.data.last_success_at);
                }
            } catch {
                setErcaStatus('error');
            }
        };
        fetchErcaStatus();
    }, []);

    function toggleIntegration(id: string) {
        setIntegrations(prev =>
            prev.map(i => {
                if (i.id !== id) return i;
                return {
                    ...i,
                    status: i.status === 'connected' ? 'disconnected' : 'connected',
                    lastSync: i.status !== 'connected' ? new Date().toISOString() : i.lastSync,
                };
            })
        );
    }

    const connectedCount = integrations.filter(i => {
        if (i.id === 'erca') return ercaStatus === 'connected';
        return i.status === 'connected';
    }).length;
    const errorCount = integrations.filter(i => {
        if (i.id === 'erca') return ercaStatus === 'error';
        return i.status === 'error';
    }).length;

    const liveIntegrations = integrations.map(i => {
        if (i.id === 'erca') {
            return { ...i, status: ercaStatus, lastSync: ercaLastSync };
        }
        return i;
    });

    return (
        <div className="space-y-4">
            {/* Status Bar */}
            <div className="flex items-center justify-between rounded-3xl bg-white px-6 py-4">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-semibold text-gray-900">
                            {connectedCount}
                        </span>
                        <span className="text-xs text-gray-400">connected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <span className="text-sm font-semibold text-gray-900">
                            {liveIntegrations.length - connectedCount}
                        </span>
                        <span className="text-xs text-gray-400">need setup</span>
                    </div>
                    {errorCount > 0 && (
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-400" />
                            <span className="text-sm font-semibold text-red-600">{errorCount}</span>
                            <span className="text-xs text-red-400">errors</span>
                        </div>
                    )}
                </div>
                <DocChecklistButton docs={INTEGRATIONS_DOCS} />
            </div>

            {CATEGORIES.map(category => (
                <div key={category} className="rounded-3xl bg-white">
                    <div className="flex items-center justify-between border-b border-gray-50 px-6 py-5">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-medium text-gray-900">{category}</h3>
                            <div className="group relative">
                                <Info
                                    className="h-4.5 w-4.5 cursor-help text-gray-300 transition-colors hover:text-gray-400"
                                    strokeWidth={1.5}
                                />
                                <div className="pointer-events-none absolute top-full left-0 z-10 mt-2 w-64 rounded-xl bg-gray-900 p-3 text-xs leading-relaxed font-normal text-white opacity-0 transition-all group-hover:opacity-100">
                                    Manage your connections for {category.toLowerCase()}. These
                                    integrations ensure data integrity across your restaurant
                                    operations.
                                    <div className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-gray-900"></div>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400">
                            {
                                liveIntegrations.filter(
                                    i => i.category === category && i.status === 'connected'
                                ).length
                            }{' '}
                            of {liveIntegrations.filter(i => i.category === category).length}{' '}
                            connected
                        </p>
                    </div>
                    <div className="space-y-3 px-6 py-5">
                        {liveIntegrations
                            .filter(i => i.category === category)
                            .map(integration => (
                                <IntegrationCard
                                    key={integration.id}
                                    integration={integration}
                                    onToggle={toggleIntegration}
                                />
                            ))}
                    </div>
                </div>
            ))}

            {/* Developer Tools */}
            <div className="mt-8 rounded-3xl bg-white p-8">
                <div className="mb-8 flex items-center justify-between border-b border-gray-50 pb-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Zap
                                className="h-5 w-5 fill-[#DDF853] stroke-black"
                                strokeWidth={2.5}
                            />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Developer Tools</h3>
                            <p className="text-xs text-gray-400">
                                Configure API access and webhook integrations.
                            </p>
                        </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-2 py-1 text-[10px] font-bold text-gray-400">
                        DEV MODE
                    </div>
                </div>

                <div className="space-y-10">
                    {/* API Key Management */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold tracking-wider text-gray-900 uppercase">
                                Merchant API Keys
                            </h4>
                            <button className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-gray-800">
                                Generate Key
                            </button>
                        </div>
                        <div className="group relative flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/30 px-5 py-4 transition-all hover:bg-white hover:shadow-none">
                            <div className="flex items-center gap-4">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-100 bg-white text-gray-400">
                                    <Lock className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-gray-900">
                                        Production Key (Live)
                                    </p>
                                    <code className="font-mono text-[10px] tracking-tight text-gray-400">
                                        pk_live_************************5678
                                    </code>
                                </div>
                            </div>
                            <button className="text-[11px] font-bold text-blue-600 italic opacity-0 transition-opacity group-hover:opacity-100">
                                Reveal Key
                            </button>
                        </div>
                    </div>

                    {/* Webhook Configuration */}
                    <div className="space-y-4 border-t border-gray-50 pt-6">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-bold tracking-wider text-gray-900 uppercase">
                                Webhook Endpoints
                            </h4>
                            <button className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-900 transition-all hover:bg-gray-50">
                                Add URL
                            </button>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/30 px-5 py-4">
                            <div className="flex items-center gap-4">
                                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-gray-100 bg-white">
                                    <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold text-gray-900">
                                        https://api.cafelucia.com/v1/webhook
                                    </p>
                                    <div className="mt-0.5 flex items-center gap-2">
                                        <span className="cursor-default rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-400 uppercase">
                                            order.paid
                                        </span>
                                        <span className="cursor-default rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-400 uppercase">
                                            order.cancelled
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <button className="text-[11px] font-bold text-gray-400 italic hover:text-gray-600">
                                    Test
                                </button>
                                <button className="rounded-lg border border-gray-100 bg-white p-2 text-gray-300 transition-all hover:text-red-500">
                                    <AlertTriangle className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
