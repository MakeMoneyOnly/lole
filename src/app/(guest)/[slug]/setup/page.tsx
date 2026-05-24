'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowRight,
    CheckCircle2,
    Loader2,
    ShieldCheck,
    Smartphone,
    Sparkles,
    TabletSmartphone,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getDeviceProfileLabel, getDeviceTypeLabel } from '@/lib/devices/config';
import { DEVICE_PAIRING_CODE_LENGTH, normalizePairingCode } from '@/lib/devices/pairing';
import { bootstrapGatewayForPairedDevice } from '@/lib/gateway/device-bootstrap';
import { getNativeDeviceInfo } from '@/lib/mobile/capacitor';
import { storeDeviceSession, storePrinterSelection } from '@/lib/mobile/device-storage';

type PairResponse = {
    device_token: string;
    device_type: string;
    device_profile?: 'cashier' | 'waiter' | 'kds' | 'kiosk' | null;
    name: string;
    restaurant_id?: string | null;
    location_id?: string | null;
    metadata?: {
        printer?: {
            connection_type?: 'bluetooth' | 'usb' | 'network' | 'none';
            device_id?: string | null;
            device_name?: string | null;
            mac_address?: string | null;
        } | null;
    } | null;
    boot_path?: string | null;
};

export default function DeviceSetupPage(): React.JSX.Element {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const slug = params?.slug as string;
    const [pairingCode, setPairingCode] = useState('');
    const [restaurantName, setRestaurantName] = useState('');
    const [status, setStatus] = useState<'idle' | 'pairing' | 'success' | 'invalid'>('idle');
    const [deviceInfo, setDeviceInfo] = useState<PairResponse | null>(null);
    const [autoPairAttempted, setAutoPairAttempted] = useState(false);

    useEffect(() => {
        const codeFromLink = normalizePairingCode(searchParams?.get('code') ?? '').slice(
            0,
            DEVICE_PAIRING_CODE_LENGTH
        );

        if (codeFromLink.length === DEVICE_PAIRING_CODE_LENGTH) {
            setPairingCode(current => (current === codeFromLink ? current : codeFromLink));
        }
    }, [searchParams]);

    useEffect(() => {
        if (!slug) return;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

        const fallbackName = slug.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

        if (!supabaseUrl || !supabaseKey) {
            setRestaurantName(fallbackName);
            return;
        }

        fetch(`${supabaseUrl}/rest/v1/restaurants?slug=eq.${slug}&select=name`, {
            headers: {
                apikey: supabaseKey,
                Authorization: `Bearer ${supabaseKey}`,
            },
        })
            .then(response => response.json())
            .then((rows: Array<{ name?: string }>) => {
                setRestaurantName(rows?.[0]?.name?.trim() || fallbackName);
            })
            .catch(() => {
                setRestaurantName(fallbackName);
            });
    }, [slug]);

    const title = useMemo(() => {
        if (restaurantName) {
            return restaurantName;
        }

        if (!slug) {
            return 'lole Device';
        }

        return slug.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    }, [restaurantName, slug]);

    const pairDevice = useCallback(
        async (rawCode: string): Promise<void> => {
            const normalizedCode = normalizePairingCode(rawCode).slice(
                0,
                DEVICE_PAIRING_CODE_LENGTH
            );
            if (normalizedCode.length !== DEVICE_PAIRING_CODE_LENGTH) {
                return;
            }

            setStatus('pairing');

            try {
                const nativeInfo = await getNativeDeviceInfo();
                const response = await fetch('/api/v1/devices/pair', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: normalizedCode,
                        device_uuid: nativeInfo.uuid ?? undefined,
                        platform: nativeInfo.platform,
                        app_version: nativeInfo.appVersion ?? nativeInfo.osVersion ?? undefined,
                    }),
                });

                const result = await response.json();

                if (!response.ok || !result.data) {
                    setStatus('invalid');
                    toast.error(result?.error ?? 'Pairing failed. Please try again.');
                    return;
                }

                const pairedDevice = result.data as PairResponse;
                setDeviceInfo(pairedDevice);
                setStatus('success');

                const gatewaySession =
                    pairedDevice.restaurant_id && pairedDevice.location_id
                        ? await bootstrapGatewayForPairedDevice({
                              deviceToken: pairedDevice.device_token,
                              restaurantId: pairedDevice.restaurant_id,
                              locationId: pairedDevice.location_id,
                              preferredBrokerUrl: process.env.NEXT_PUBLIC_LAN_MQTT_URL ?? null,
                              fallbackBootstrapUrl:
                                  process.env.NEXT_PUBLIC_GATEWAY_BOOTSTRAP_URL ?? null,
                          })
                        : null;

                await storeDeviceSession({
                    device_token: pairedDevice.device_token,
                    device_type: pairedDevice.device_type,
                    device_profile: pairedDevice.device_profile ?? null,
                    name: pairedDevice.name,
                    restaurant_id: pairedDevice.restaurant_id ?? null,
                    location_id: pairedDevice.location_id ?? null,
                    boot_path: pairedDevice.boot_path ?? null,
                    metadata: pairedDevice.metadata ?? null,
                    gateway: gatewaySession,
                    gateway_bootstrap_status: gatewaySession ? 'ready' : 'unavailable',
                });

                if (pairedDevice.metadata?.printer?.connection_type) {
                    await storePrinterSelection({
                        connection_type: pairedDevice.metadata.printer.connection_type,
                        device_id: pairedDevice.metadata.printer.device_id ?? null,
                        device_name: pairedDevice.metadata.printer.device_name ?? null,
                        mac_address: pairedDevice.metadata.printer.mac_address ?? null,
                    });
                }

                if (!gatewaySession) {
                    toast.error('Device paired, but local gateway bootstrap is still unavailable.');
                }

                window.setTimeout(() => {
                    router.push('/device');
                }, 1600);
            } catch {
                setStatus('invalid');
                toast.error('Pairing failed. Check connectivity and try again.');
            }
        },
        [router]
    );

    const handlePair = async (event: React.FormEvent): Promise<void> => {
        event.preventDefault();
        await pairDevice(pairingCode);
    };

    useEffect(() => {
        const codeFromLink = normalizePairingCode(searchParams?.get('code') ?? '').slice(
            0,
            DEVICE_PAIRING_CODE_LENGTH
        );

        if (
            autoPairAttempted ||
            codeFromLink.length !== DEVICE_PAIRING_CODE_LENGTH ||
            status === 'pairing' ||
            status === 'success'
        ) {
            return;
        }

        setAutoPairAttempted(true);
        void pairDevice(codeFromLink);
    }, [autoPairAttempted, pairDevice, searchParams, status]);

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#fbf6ef] text-[#131313]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(168,24,24,0.12),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(242,201,76,0.18),_transparent_32%),linear-gradient(135deg,_rgba(224,242,233,0.58),_rgba(255,255,255,0.92))]" />
            <div className="absolute inset-x-0 top-0 h-px bg-black/10" />

            <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-6 py-10 lg:flex-row lg:items-center lg:px-10">
                <section className="max-w-xl space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/75 px-4 py-2 text-[11px] font-black tracking-[0.24em] text-black/60 uppercase shadow-sm backdrop-blur">
                        <Sparkles className="h-3.5 w-3.5 text-[#A81818]" />
                        Enterprise Provisioning
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm font-black tracking-[0.28em] text-[#A81818]/80 uppercase">
                            {title}
                        </p>
                        <h1 className="max-w-xl text-4xl font-black tracking-[-0.04em] text-black md:text-6xl">
                            Welcome this device into the lole fleet.
                        </h1>
                        <p className="max-w-lg text-base font-medium text-black/65 md:text-lg">
                            Enter the pairing code from your merchant dashboard. This tablet will
                            remember its profile, printer, and startup flow on every reboot.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[1.75rem] border border-black/10 bg-white/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.05)] backdrop-blur">
                            <TabletSmartphone className="h-5 w-5 text-[#1848A8]" />
                            <p className="mt-4 text-sm font-bold text-black">One APK</p>
                            <p className="mt-1 text-sm text-black/55">
                                Cashier, waiter, KDS, or kiosk
                            </p>
                        </div>
                        <div className="rounded-[1.75rem] border border-black/10 bg-white/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.05)] backdrop-blur">
                            <ShieldCheck className="h-5 w-5 text-[#A81818]" />
                            <p className="mt-4 text-sm font-bold text-black">Tenant-scoped</p>
                            <p className="mt-1 text-sm text-black/55">
                                Paired to the right merchant context
                            </p>
                        </div>
                        <div className="rounded-[1.75rem] border border-black/10 bg-white/80 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.05)] backdrop-blur">
                            <Smartphone className="h-5 w-5 text-[#0f766e]" />
                            <p className="mt-4 text-sm font-bold text-black">Silent hardware</p>
                            <p className="mt-1 text-sm text-black/55">
                                Ready for native printer memory
                            </p>
                        </div>
                    </div>
                </section>

                <section className="w-full max-w-xl">
                    <div className="overflow-hidden rounded-[2rem] border border-black/10 bg-white/80 p-6 shadow-[0_28px_100px_rgba(0,0,0,0.08)] backdrop-blur md:p-8">
                        {status !== 'success' ? (
                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <p className="text-[11px] font-black tracking-[0.24em] text-black/45 uppercase">
                                        Welcome Screen
                                    </p>
                                    <h2 className="text-3xl font-black tracking-[-0.03em] text-black">
                                        Pair this tablet
                                    </h2>
                                    <p className="max-w-md text-sm font-medium text-black/55">
                                        Use the six-character pairing code generated from the
                                        merchant dashboard. No manual URLs or staff login are
                                        required after this step.
                                    </p>
                                </div>

                                <form onSubmit={handlePair} className="space-y-6">
                                    <label className="block space-y-3">
                                        <span className="text-[11px] font-black tracking-[0.24em] text-black/45 uppercase">
                                            Pairing Code
                                        </span>
                                        <input
                                            value={pairingCode}
                                            onChange={event => {
                                                setPairingCode(
                                                    normalizePairingCode(event.target.value).slice(
                                                        0,
                                                        DEVICE_PAIRING_CODE_LENGTH
                                                    )
                                                );
                                                if (status === 'invalid') {
                                                    setStatus('idle');
                                                }
                                            }}
                                            autoFocus
                                            placeholder="A1B2C3"
                                            className={cn(
                                                'w-full rounded-[1.5rem] border px-5 py-5 text-center font-mono text-4xl font-black tracking-[0.42em] text-black transition-all outline-none md:text-5xl',
                                                status === 'invalid'
                                                    ? 'border-[#A81818]/20 bg-[#fff2f2] ring-4 ring-[#A81818]/10'
                                                    : 'border-black/10 bg-[#fcfbf7] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus:border-[#A81818]/30 focus:ring-4 focus:ring-[#A81818]/10'
                                            )}
                                        />
                                    </label>

                                    <Button
                                        type="submit"
                                        disabled={
                                            pairingCode.length !== DEVICE_PAIRING_CODE_LENGTH ||
                                            status === 'pairing'
                                        }
                                        className="group flex w-full items-center justify-center gap-2 rounded-[1.4rem] bg-[#F2C94C] px-6 py-4 text-base font-black text-black shadow-[0_18px_42px_rgba(242,201,76,0.28)] transition-transform hover:scale-[1.01] hover:bg-[#efc33c] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:scale-100"
                                    >
                                        {status === 'pairing' ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>
                                                Pair Device
                                                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                                            </>
                                        )}
                                    </Button>
                                </form>

                                <div className="rounded-[1.5rem] border border-black/8 bg-[#f8f5ef] px-4 py-4 text-sm font-medium text-black/55">
                                    This device keeps its role and printer memory locally so it can
                                    recover cleanly after reboot or weak connectivity.
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 text-center">
                                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#E0F2E9] text-[#0f766e] shadow-[0_20px_40px_rgba(16,185,129,0.18)]">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>

                                <div className="space-y-3">
                                    <p className="text-[11px] font-black tracking-[0.24em] text-black/45 uppercase">
                                        Device Ready
                                    </p>
                                    <h2 className="text-3xl font-black tracking-[-0.03em] text-black">
                                        {deviceInfo?.name}
                                    </h2>
                                    <p className="text-sm font-medium text-black/55">
                                        Launching{' '}
                                        {getDeviceProfileLabel(deviceInfo?.device_profile)} mode on{' '}
                                        {getDeviceTypeLabel(deviceInfo?.device_type)}.
                                    </p>
                                </div>

                                <div className="rounded-[1.5rem] border border-black/8 bg-[#fcfbf7] p-5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-[11px] font-black tracking-[0.24em] text-black/45 uppercase">
                                                Assigned Profile
                                            </p>
                                            <p className="mt-2 text-xl font-black text-black">
                                                {getDeviceProfileLabel(deviceInfo?.device_profile)}
                                            </p>
                                        </div>
                                        <Loader2 className="h-6 w-6 animate-spin text-[#A81818]" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
