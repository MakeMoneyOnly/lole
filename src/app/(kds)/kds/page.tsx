'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { ManagedDeviceBanner } from '@/components/device/shell/ManagedDeviceBanner';
import { useRole } from '@/features/auth/hooks/useRole';
import { useManagedDeviceSession } from '@/features/merchant/hooks/useManagedDeviceSession';
import { StationBoard } from '@/features/kds/components/StationBoard';

type StationView = 'kitchen' | 'bar' | 'dessert' | 'coffee';

const STATION_CONFIG: Record<StationView, { title: string; accentClassName: string }> = {
    kitchen: { title: 'Kitchen Display', accentClassName: 'bg-emerald-100 text-emerald-700' },
    bar: { title: 'Bar Display', accentClassName: 'bg-blue-100 text-blue-700' },
    dessert: { title: 'Dessert Display', accentClassName: 'bg-fuchsia-100 text-fuchsia-700' },
    coffee: { title: 'Coffee Display', accentClassName: 'bg-amber-100 text-amber-800' },
};

function KdsPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const queryRestaurantId = searchParams.get('restaurantId');
    const queryStation = searchParams.get('station');
    const { role, loading } = useRole(queryRestaurantId);
    const managedDevice = useManagedDeviceSession({
        route: '/kds',
        expectedProfiles: ['kds'],
    });

    useEffect(() => {
        if (loading) return;
        if (role === 'bar' && !queryStation) {
            router.replace('/bar');
        }
    }, [loading, role, router, queryStation]);

    const station: StationView =
        queryStation === 'bar' || queryStation === 'dessert' || queryStation === 'coffee'
            ? queryStation
            : 'kitchen';

    const config = STATION_CONFIG[station];

    if (managedDevice.loading) {
        return (
            <div className="font-inter flex min-h-screen items-center justify-center bg-[#F7F5F2] p-10 tracking-[-0.04em]">
                <div className="flex flex-col items-center gap-6 rounded-3xl border border-gray-100 bg-white p-12">
                    <div className="h-12 w-12 animate-spin rounded-full border-2 border-gray-100 border-t-[#DDF853]" />
                    <p className="text-[11px] font-black tracking-[0.2em] text-[#1A1C1E] uppercase">
                        Booting KDS Workspace
                    </p>
                </div>
            </div>
        );
    }

    if (managedDevice.hasProfileMismatch) {
        return (
            <div className="font-inter flex min-h-screen flex-col items-center justify-center bg-[#F7F5F2] p-10 tracking-[-0.04em]">
                <div className="w-full max-w-md space-y-8 rounded-[2rem] border border-gray-100 bg-white p-12 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold text-[#1A1C1E]">Wrong Role.</h1>
                        <p className="leading-relaxed font-medium text-gray-500">
                            This device is paired for a different workspace. Re-provision it as a
                            KDS screen to access the kitchen display.
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/device')}
                        className="w-full rounded-xl bg-[#1A1C1E] py-4 text-sm font-bold text-white"
                    >
                        Return to Shell
                    </button>
                </div>
            </div>
        );
    }

    if (managedDevice.isIdentityRevoked || !managedDevice.hasOutageAccess) {
        return (
            <div className="font-inter flex min-h-screen flex-col items-center justify-center bg-[#F7F5F2] p-10 tracking-[-0.04em]">
                <div className="w-full max-w-md space-y-8 rounded-[2rem] border border-gray-100 bg-white p-12 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">
                        <AlertCircle className="h-8 w-8" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold text-[#1A1C1E]">Access Paused.</h1>
                        <p className="leading-relaxed font-medium text-gray-500">
                            {managedDevice.isIdentityRevoked
                                ? 'This kitchen screen identity was revoked. Re-pair it from device management.'
                                : (managedDevice.outageAccess.reason ??
                                  'This kitchen screen needs fresh online authorization.')}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <StationBoard
            station={station}
            title={config.title}
            accentClassName={config.accentClassName}
            restaurantIdOverride={managedDevice.session?.restaurant_id ?? null}
            headerSlot={
                <ManagedDeviceBanner session={managedDevice.session} routeLabel={config.title} />
            }
        />
    );
}

export default function KdsPage() {
    return (
        <div className="font-inter min-h-screen bg-[#F7F5F2] tracking-[-0.04em]">
            <Suspense
                fallback={
                    <div className="flex min-h-screen items-center justify-center p-10">
                        <div className="flex flex-col items-center gap-4">
                            <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-[#DDF853]" />
                            <p className="text-[11px] font-black tracking-widest text-gray-400 uppercase">
                                Loading KDS
                            </p>
                        </div>
                    </div>
                }
            >
                <KdsPageContent />
            </Suspense>
        </div>
    );
}
