'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, RotateCcw, ShieldAlert, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export interface FleetDeviceRecord {
    id: string;
    restaurantId: string;
    restaurantName: string;
    name: string;
    deviceProfile: string;
    deviceType: string;
    pairingState: string;
    managementProvider: string;
    managementStatus: string;
    managementDeviceId: string | null;
    appVersion: string | null;
    appChannel: string | null;
    targetAppVersion: string | null;
    otaStatus: string;
    otaError: string | null;
    lastActiveAt: string | null;
    lastBootAt: string | null;
}

export interface FleetActionRecord {
    id: string;
    hardwareDeviceId: string;
    actionType: string;
    status: string;
    requestedAt: string | null;
    providerJobId: string | null;
}
function formatTime(value: string | null | undefined): React.JSX.Element | null {
    if (!value) return null;

    return (
        <>
            {new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(new Date(value))}
        </>
    );
}

export function FleetManagementPageClient(args: {
    devices: FleetDeviceRecord[];
    actions: FleetActionRecord[];
}): React.JSX.Element {
    const router = useRouter();
    const [pendingDeviceId, setPendingDeviceId] = useState<string | null>(null);
    const [versionDrafts, setVersionDrafts] = useState<Record<string, string>>({});
    const [channelDrafts, setChannelDrafts] = useState<Record<string, string>>({});
    const [isRefreshing, startRefresh] = useTransition();

    const latestActionsByDevice = useMemo(() => {
        const map = new Map<string, FleetActionRecord>();
        for (const action of args.actions) {
            if (!map.has(action.hardwareDeviceId)) {
                map.set(action.hardwareDeviceId, action);
            }
        }
        return map;
    }, [args.actions]);

    const summary = useMemo(() => {
        const managed = args.devices.filter(device => device.managementProvider === 'esper').length;
        const pendingUpdates = args.devices.filter(device =>
            ['queued', 'installing', 'outdated', 'failed'].includes(device.otaStatus)
        ).length;
        const activeNow = args.devices.filter(device => Boolean(device.lastActiveAt)).length;
        const alerting = args.devices.filter(device => device.otaStatus === 'failed').length;

        return { managed, pendingUpdates, activeNow, alerting };
    }, [args.devices]);

    const runAction = async (
        deviceId: string,
        body: Record<string, unknown>,
        successLabel: string
    ): Promise<void> => {
        try {
            setPendingDeviceId(deviceId);
            const response = await fetch(
                `/api/internal/fleet/devices/${deviceId}/management-actions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                }
            );
            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.error?.message ?? payload?.error ?? 'Fleet action failed');
            }

            toast.success(successLabel);
            startRefresh(() => router.refresh());
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Fleet action failed');
        } finally {
            setPendingDeviceId(null);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-brand-canvas)] px-6 py-10 text-[var(--color-brand-ink)] lg:px-10">
            <div className="mx-auto max-w-7xl space-y-8">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                    <div>
                        <p className="text-[11px] font-black tracking-[0.24em] text-[var(--color-brand-ember)] uppercase">
                            Agency Fleet
                        </p>
                        <h1 className="mt-3 text-5xl font-black tracking-[-0.05em] text-[var(--color-brand-ink-strong)]">
                            Managed Android estate
                        </h1>
                        <p className="mt-3 max-w-3xl text-base leading-7 font-medium text-[var(--color-brand-neutral)]">
                            Reboot, wipe, and stage OTA updates for paired devices without exposing
                            Esper controls in merchant workflows.
                        </p>
                    </div>

                    <button
                        onClick={() => startRefresh(() => router.refresh())}
                        className="inline-flex items-center justify-center gap-2 rounded-[1.3rem] bg-white px-5 py-3 text-sm font-black text-[var(--color-brand-ink-strong)] shadow-[0_16px_40px_rgba(23,18,11,0.08)]"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh Fleet
                    </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[2rem] bg-white p-5 shadow-[0_18px_50px_rgba(23,18,11,0.08)]">
                        <p className="text-[11px] font-black tracking-[0.24em] text-[var(--color-brand-neutral)] uppercase">
                            Esper Managed
                        </p>
                        <p className="mt-3 text-4xl font-black tracking-tight">{summary.managed}</p>
                    </div>
                    <div className="rounded-[2rem] bg-white p-5 shadow-[0_18px_50px_rgba(23,18,11,0.08)]">
                        <p className="text-[11px] font-black tracking-[0.24em] text-[var(--color-brand-neutral)] uppercase">
                            OTA Attention
                        </p>
                        <p className="mt-3 text-4xl font-black tracking-tight">
                            {summary.pendingUpdates}
                        </p>
                    </div>
                    <div className="rounded-[2rem] bg-white p-5 shadow-[0_18px_50px_rgba(23,18,11,0.08)]">
                        <p className="text-[11px] font-black tracking-[0.24em] text-[var(--color-brand-neutral)] uppercase">
                            Active Footprint
                        </p>
                        <p className="mt-3 text-4xl font-black tracking-tight">
                            {summary.activeNow}
                        </p>
                    </div>
                    <div className="rounded-[2rem] bg-white p-5 shadow-[0_18px_50px_rgba(23,18,11,0.08)]">
                        <p className="text-[11px] font-black tracking-[0.24em] text-[var(--color-brand-neutral)] uppercase">
                            Failed Updates
                        </p>
                        <p className="mt-3 text-4xl font-black tracking-tight">
                            {summary.alerting}
                        </p>
                    </div>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                    {args.devices.map(device => {
                        const latestAction = latestActionsByDevice.get(device.id);
                        const versionDraft =
                            versionDrafts[device.id] ?? device.targetAppVersion ?? '';
                        const channelDraft =
                            channelDrafts[device.id] ?? device.appChannel ?? 'stable';

                        return (
                            <section
                                key={device.id}
                                className="overflow-hidden rounded-[2rem] bg-white p-6 shadow-[0_20px_60px_rgba(23,18,11,0.08)]"
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <p className="text-[11px] font-black tracking-[0.24em] text-[var(--color-brand-ember)] uppercase">
                                            {device.restaurantName}
                                        </p>
                                        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--color-brand-ink-strong)]">
                                            {device.name}
                                        </h2>
                                        <p className="mt-2 text-sm font-medium text-[var(--color-brand-neutral)]">
                                            {device.deviceProfile} · {device.deviceType} · pairing{' '}
                                            {device.pairingState}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <span className="rounded-full bg-[var(--color-brand-canvas)] px-3 py-1 text-[11px] font-black tracking-[0.2em] text-[var(--color-brand-neutral)] uppercase">
                                            OTA {device.otaStatus}
                                        </span>
                                        <span className="rounded-full bg-[var(--color-brand-accent)] px-3 py-1 text-[11px] font-black tracking-[0.2em] text-[var(--color-brand-ink-strong)] uppercase">
                                            {device.managementProvider}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-3 md:grid-cols-2">
                                    <div className="rounded-[1.4rem] bg-[var(--color-brand-canvas)] p-4">
                                        <p className="text-[11px] font-black tracking-[0.2em] text-[var(--color-brand-neutral)] uppercase">
                                            App State
                                        </p>
                                        <p className="mt-3 text-sm font-bold text-[var(--color-brand-ink-strong)]">
                                            Current {device.appVersion ?? 'unknown'}
                                        </p>
                                        <p className="mt-1 text-sm text-[var(--color-brand-neutral)]">
                                            Target {device.targetAppVersion ?? 'not scheduled'} ·
                                            channel {device.appChannel ?? 'stable'}
                                        </p>
                                    </div>
                                    <div className="rounded-[1.4rem] bg-[var(--color-brand-canvas)] p-4">
                                        <p className="text-[11px] font-black tracking-[0.2em] text-[var(--color-brand-neutral)] uppercase">
                                            Device Health
                                        </p>
                                        <p className="mt-3 text-sm font-bold text-[var(--color-brand-ink-strong)]">
                                            Last active {formatTime(device.lastActiveAt)}
                                        </p>
                                        <p className="mt-1 text-sm text-[var(--color-brand-neutral)]">
                                            Last boot {formatTime(device.lastBootAt)}
                                        </p>
                                    </div>
                                </div>

                                {device.otaError ? (
                                    <div className="mt-4 flex items-start gap-2 rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>{device.otaError}</span>
                                    </div>
                                ) : null}

                                <div className="mt-5 grid gap-3 md:grid-cols-[1fr_140px]">
                                    <input
                                        value={versionDraft}
                                        onChange={event =>
                                            setVersionDrafts(current => ({
                                                ...current,
                                                [device.id]: event.target.value,
                                            }))
                                        }
                                        placeholder="Target app version"
                                        className="h-12 rounded-[1rem] border border-black/8 bg-[var(--color-brand-canvas)] px-4 text-sm font-bold text-[var(--color-brand-ink-strong)] outline-none focus:border-black/20"
                                    />
                                    <input
                                        value={channelDraft}
                                        onChange={event =>
                                            setChannelDrafts(current => ({
                                                ...current,
                                                [device.id]: event.target.value,
                                            }))
                                        }
                                        placeholder="stable"
                                        className="h-12 rounded-[1rem] border border-black/8 bg-[var(--color-brand-canvas)] px-4 text-sm font-bold text-[var(--color-brand-ink-strong)] outline-none focus:border-black/20"
                                    />
                                </div>

                                <div className="mt-4 flex flex-wrap gap-3">
                                    <button
                                        onClick={() =>
                                            void runAction(
                                                device.id,
                                                {
                                                    action: 'push_update',
                                                    app_version: versionDraft,
                                                    app_channel: channelDraft,
                                                },
                                                `Queued OTA for ${device.name}`
                                            )
                                        }
                                        disabled={
                                            pendingDeviceId === device.id || !versionDraft.trim()
                                        }
                                        className="inline-flex h-12 items-center justify-center gap-2 rounded-[1rem] bg-[var(--color-brand-accent)] px-5 text-sm font-black text-[var(--color-brand-ink-strong)] disabled:opacity-50"
                                    >
                                        <Smartphone className="h-4 w-4" />
                                        Queue OTA
                                    </button>
                                    <button
                                        onClick={() =>
                                            void runAction(
                                                device.id,
                                                { action: 'reboot' },
                                                `Reboot sent to ${device.name}`
                                            )
                                        }
                                        disabled={pendingDeviceId === device.id}
                                        className="inline-flex h-12 items-center justify-center gap-2 rounded-[1rem] bg-white px-5 text-sm font-black text-[var(--color-brand-ink-strong)] shadow-[0_12px_30px_rgba(23,18,11,0.06)] disabled:opacity-50"
                                    >
                                        <RotateCcw className="h-4 w-4" />
                                        Reboot
                                    </button>
                                    <button
                                        onClick={() =>
                                            void runAction(
                                                device.id,
                                                { action: 'wipe' },
                                                `Wipe sent to ${device.name}`
                                            )
                                        }
                                        disabled={pendingDeviceId === device.id}
                                        className="inline-flex h-12 items-center justify-center gap-2 rounded-[1rem] bg-red-50 px-5 text-sm font-black text-red-700 disabled:opacity-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Wipe
                                    </button>
                                </div>

                                <div className="mt-5 rounded-[1.4rem] border border-black/5 bg-[var(--color-brand-canvas)] px-4 py-3 text-sm">
                                    <p className="font-bold text-[var(--color-brand-ink-strong)]">
                                        Latest action:{' '}
                                        {latestAction
                                            ? `${latestAction.actionType} · ${latestAction.status}`
                                            : 'No remote action yet'}
                                    </p>
                                    <p className="mt-1 text-[var(--color-brand-neutral)]">
                                        {latestAction
                                            ? `${formatTime(latestAction.requestedAt)} · job ${latestAction.providerJobId ?? 'pending'}`
                                            : `Management status ${device.managementStatus} · device id ${device.managementDeviceId ?? 'pending'}`}
                                    </p>
                                </div>
                            </section>
                        );
                    })}
                </div>

                {args.devices.length === 0 ? (
                    <div className="rounded-[2rem] bg-white p-8 text-center shadow-[0_20px_60px_rgba(23,18,11,0.08)]">
                        <ShieldAlert className="mx-auto h-8 w-8 text-[var(--color-brand-ember)]" />
                        <h2 className="mt-4 text-2xl font-black tracking-tight text-[var(--color-brand-ink-strong)]">
                            No managed devices found
                        </h2>
                        <p className="mt-2 text-sm font-medium text-[var(--color-brand-neutral)]">
                            Once restaurants pair Esper-managed hardware, the fleet will appear
                            here.
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
