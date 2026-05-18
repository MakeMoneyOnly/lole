'use client';

import { AlertTriangle, Cpu, Route, ShieldCheck, WifiOff } from 'lucide-react';
import { getDeviceShellSummary } from '@/lib/devices/shell';
import type { StoredDeviceSession } from '@/lib/mobile/device-storage';
import {
    evaluateOfflineStaffAccess,
    resolveOfflineStaffOutagePolicy,
} from '@/lib/auth/offline-authz';

export function ManagedDeviceBanner(args: {
    session: StoredDeviceSession | null;
    routeLabel: string;
    className?: string;
}): React.JSX.Element | null {
    if (!args.session) {
        return null;
    }

    const summary = getDeviceShellSummary(args.session);
    const outagePolicy = resolveOfflineStaffOutagePolicy(args.session.metadata ?? null, {
        deviceType:
            args.session.device_type === 'terminal' ||
            args.session.device_type === 'kds' ||
            args.session.device_type === 'kiosk'
                ? args.session.device_type
                : 'pos',
        deviceProfile: args.session.device_profile ?? null,
    });
    const outageAccess = evaluateOfflineStaffAccess({
        policy: outagePolicy,
        isOnline: args.session.gateway?.operatingMode === 'online',
    });
    const operatingMode = args.session.gateway?.operatingMode ?? 'offline-local';

    return (
        <div
            className={`overflow-hidden rounded-[1.75rem] border border-black/5 bg-white/88 p-4 shadow-[0_18px_50px_rgba(23,18,11,0.08)] backdrop-blur ${args.className ?? ''}`}
        >
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-accent)] px-3 py-1 text-[10px] font-black tracking-[0.22em] text-[var(--color-brand-ink-strong)] uppercase">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Managed Device
                    </div>
                    <h2 className="mt-3 text-xl font-black tracking-[-0.03em] text-[var(--color-brand-ink-strong)]">
                        {summary.deviceName}
                    </h2>
                    <p className="mt-1 text-sm font-medium text-[var(--color-brand-neutral)]">
                        {summary.profileLabel} mode is active for {args.routeLabel}.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold tracking-[0.16em] uppercase">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-canvas)] px-3 py-1 text-[var(--color-brand-ink-strong)]">
                            <WifiOff className="h-3.5 w-3.5 text-[var(--color-brand-ember)]" />
                            {operatingMode}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-canvas)] px-3 py-1 text-[var(--color-brand-ink-strong)]">
                            <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-brand-ember)]" />
                            {outageAccess.allowed
                                ? 'Outage access ready'
                                : (outageAccess.reason ?? 'Outage restricted')}
                        </span>
                    </div>
                </div>

                <div className="grid min-w-[240px] gap-2 text-sm text-[var(--color-brand-neutral)] sm:grid-cols-2">
                    <div className="rounded-[1.2rem] bg-[var(--color-brand-canvas)] px-3 py-2">
                        <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.22em] uppercase">
                            <Cpu className="h-3.5 w-3.5 text-[var(--color-brand-ember)]" />
                            Profile
                        </div>
                        <p className="mt-2 font-bold text-[var(--color-brand-ink-strong)]">
                            {summary.typeLabel}
                        </p>
                    </div>
                    <div className="rounded-[1.2rem] bg-[var(--color-brand-canvas)] px-3 py-2">
                        <div className="flex items-center gap-2 text-[10px] font-black tracking-[0.22em] uppercase">
                            <Route className="h-3.5 w-3.5 text-[var(--color-brand-ember)]" />
                            Launch Path
                        </div>
                        <p className="mt-2 font-bold text-[var(--color-brand-ink-strong)]">
                            {summary.launchPath}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
