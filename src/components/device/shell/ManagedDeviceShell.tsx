'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    ChefHat,
    Loader2,
    MonitorSpeaker,
    Printer,
    QrCode,
    ShieldCheck,
    Store,
    TabletSmartphone,
} from 'lucide-react';
import { getDeviceProfileLabel } from '@/lib/devices/config';
import { getDeviceShellSummary } from '@/lib/devices/shell';
import {
    clearDeviceSession,
    clearPrinterSelection,
    getStoredDeviceSession,
    getStoredPrinterSelection,
    type StoredDeviceSession,
    type StoredPrinterSelection,
} from '@/lib/mobile/device-storage';

const PROFILE_ART = {
    cashier: {
        icon: Store,
        eyebrow: 'Cashier Terminal',
        blurb: 'Checkout, receipt printing, and front-counter settlement.',
    },
    waiter: {
        icon: TabletSmartphone,
        eyebrow: 'Waiter Flow',
        blurb: 'Tableside ordering, guest pacing, and service requests.',
    },
    kds: {
        icon: ChefHat,
        eyebrow: 'Kitchen Display',
        blurb: 'Active order grid, completion toggles, and kitchen handoff.',
    },
    kiosk: {
        icon: QrCode,
        eyebrow: 'Self-Service Kiosk',
        blurb: 'Guest-facing ordering and QR-led payment collection.',
    },
} as const;

export function ManagedDeviceShell(): React.JSX.Element {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<StoredDeviceSession | null>(null);
    const [printer, setPrinter] = useState<StoredPrinterSelection | null>(null);
    const [hasLaunched, setHasLaunched] = useState(false);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            try {
                const [storedSession, storedPrinter] = await Promise.all([
                    getStoredDeviceSession(),
                    getStoredPrinterSelection(),
                ]);

                if (cancelled) return;

                setSession(storedSession);
                setPrinter(storedPrinter);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const shellSummary = useMemo(() => {
        return session ? getDeviceShellSummary(session) : null;
    }, [session]);

    useEffect(() => {
        if (!shellSummary?.launchPath || hasLaunched) return;

        const timer = window.setTimeout(() => {
            setHasLaunched(true);
            router.replace(shellSummary.launchPath);
        }, 1200);

        return () => window.clearTimeout(timer);
    }, [hasLaunched, router, shellSummary]);

    const profileConfig =
        PROFILE_ART[
            (session?.device_profile as keyof typeof PROFILE_ART | undefined) ?? 'waiter'
        ] ?? PROFILE_ART.waiter;
    const ProfileIcon = profileConfig.icon;

    if (isLoading) {
        return (
            <div className="font-inter flex min-h-screen items-center justify-center bg-[#F7F5F2] p-10 tracking-[-0.04em]">
                <div className="flex flex-col items-center gap-6 rounded-3xl border border-gray-100 bg-white p-12">
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-100 border-t-[#DDF853]" />
                    <p className="text-[11px] font-black tracking-[0.2em] text-[#1A1C1E] uppercase">
                        Booting Managed Shell
                    </p>
                </div>
            </div>
        );
    }

    if (!session || !shellSummary) {
        return (
            <div className="font-inter flex min-h-screen flex-col items-center justify-center bg-[#F7F5F2] p-10 tracking-[-0.04em]">
                <div className="grid w-full max-w-4xl gap-8 md:grid-cols-2">
                    <div className="space-y-8 py-10">
                        <div className="inline-flex rounded-full bg-[#DDF853] px-4 py-1.5 text-[11px] font-bold tracking-[0.05em] text-[#1A1C1E] uppercase">
                            Setup Required
                        </div>
                        <h1 className="text-6xl leading-[0.95] font-bold text-[#1A1C1E]">
                            Device Unpaired.
                        </h1>
                        <p className="text-xl leading-relaxed font-medium text-gray-500">
                            This hardware is ready for Lole Enterprise, but hasn't been assigned to
                            a restaurant yet.
                        </p>
                    </div>

                    <div className="space-y-8 rounded-3xl border border-gray-100 bg-white p-10">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F7F5F2] text-[#1A1C1E]">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-2xl font-bold text-[#1A1C1E]">
                                Enter Pairing Code
                            </h2>
                            <p className="leading-relaxed text-gray-500">
                                Open your Merchant Dashboard, navigate to{' '}
                                <strong>Settings &gt; Devices</strong>, and generate a new pairing
                                token.
                            </p>
                        </div>
                        <div className="pt-4">
                            <button className="w-full rounded-xl bg-[#1A1C1E] py-4 text-sm font-bold text-white transition-opacity hover:opacity-90">
                                View Documentation
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="font-inter flex min-h-screen flex-col bg-[#F7F5F2] p-10 tracking-[-0.04em]">
            <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-12">
                <div className="grid items-start gap-16 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-10">
                        <div className="flex items-center gap-3">
                            <div className="h-3 w-3 animate-pulse rounded-full bg-[#DDF853]" />
                            <span className="text-[11px] font-bold tracking-[0.1em] text-gray-400 uppercase">
                                System Online / {shellSummary.managedModeLabel}
                            </span>
                        </div>

                        <div className="space-y-6">
                            <h1 className="text-7xl leading-[0.9] font-bold text-[#1A1C1E]">
                                {shellSummary.profileLabel} Mode.
                            </h1>
                            <p className="max-w-xl text-2xl leading-snug font-medium text-gray-500">
                                {profileConfig.blurb}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4">
                            <div className="space-y-6 rounded-3xl border border-gray-100 bg-white p-8">
                                <ProfileIcon className="h-6 w-6 text-[#1A1C1E]" />
                                <div>
                                    <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">
                                        Profile
                                    </p>
                                    <p className="text-lg font-bold text-[#1A1C1E]">
                                        {shellSummary.profileLabel}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-6 rounded-3xl border border-gray-100 bg-white p-8">
                                <Printer className="h-6 w-6 text-[#1A1C1E]" />
                                <div>
                                    <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase">
                                        Hardware
                                    </p>
                                    <p className="truncate text-lg font-bold text-[#1A1C1E]">
                                        {printer?.device_name?.trim() || 'No Printer'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white">
                        <div className="space-y-8 p-10">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold tracking-[0.2em] text-gray-400 uppercase">
                                    Handoff Queue
                                </h3>
                                <Loader2 className="h-5 w-5 animate-spin text-[#DDF853]" />
                            </div>

                            <div className="space-y-3">
                                {(['cashier', 'waiter', 'kds', 'kiosk'] as const).map(profile => {
                                    const active = session.device_profile === profile;
                                    return (
                                        <div
                                            key={profile}
                                            className={`flex items-center justify-between rounded-xl border px-6 py-4 ${
                                                active
                                                    ? 'border-[#1A1C1E] bg-[#1A1C1E] text-white'
                                                    : 'border-transparent bg-[#F7F5F2] text-gray-400'
                                            }`}
                                        >
                                            <span className="text-sm font-bold">
                                                {getDeviceProfileLabel(profile)}
                                            </span>
                                            {active && (
                                                <span className="text-[10px] font-black tracking-widest text-[#DDF853] uppercase">
                                                    Active
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex gap-3 bg-[#F7F5F2] p-4">
                            <button
                                onClick={() => router.replace(shellSummary.launchPath)}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#DDF853] py-4 text-sm font-bold text-[#1A1C1E] transition-colors hover:bg-[#cbe346]"
                            >
                                Launch Now
                                <ArrowRight className="h-4 w-4" />
                            </button>
                            <button
                                onClick={async () => {
                                    await clearDeviceSession();
                                    await clearPrinterSelection();
                                    router.refresh();
                                }}
                                title="Clear Pairing"
                                className="flex h-14 w-14 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 transition-colors hover:text-red-500"
                            >
                                <ShieldCheck className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
