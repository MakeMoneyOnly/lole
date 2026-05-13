'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import { ManagedDeviceBanner } from '@/components/device/shell/ManagedDeviceBanner';
import { useRole } from '@/features/auth/hooks/useRole';
import { useManagedDeviceSession } from '@/hooks/useManagedDeviceSession';
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
            <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-10 font-inter tracking-[-0.04em]">
                <div className="bg-white border border-gray-100 rounded-3xl p-12 flex flex-col items-center gap-6">
                    <div className="w-12 h-12 rounded-full border-2 border-gray-100 border-t-[#DDF853] animate-spin" />
                    <p className="text-[11px] font-black tracking-[0.2em] text-[#1A1C1E] uppercase">
                        Booting KDS Workspace
                    </p>
                </div>
            </div>
        );
    }

    if (managedDevice.hasProfileMismatch) {
        return (
            <div className="min-h-screen bg-[#F7F5F2] font-inter tracking-[-0.04em] p-10 flex flex-col items-center justify-center">
                <div className="max-w-md w-full bg-white border border-gray-100 rounded-[2rem] p-12 text-center space-y-8">
                    <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold text-[#1A1C1E]">Wrong Role.</h1>
                        <p className="text-gray-500 font-medium leading-relaxed">
                            This device is paired for a different workspace. Re-provision it as a KDS screen to access the kitchen display.
                        </p>
                    </div>
                    <button 
                        onClick={() => router.push('/device')}
                        className="w-full bg-[#1A1C1E] text-white py-4 rounded-xl font-bold text-sm"
                    >
                        Return to Shell
                    </button>
                </div>
            </div>
        );
    }

    if (managedDevice.isIdentityRevoked || !managedDevice.hasOutageAccess) {
        return (
            <div className="min-h-screen bg-[#F7F5F2] font-inter tracking-[-0.04em] p-10 flex flex-col items-center justify-center">
                <div className="max-w-md w-full bg-white border border-gray-100 rounded-[2rem] p-12 text-center space-y-8">
                    <div className="mx-auto w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center">
                        <AlertCircle className="w-8 h-8" />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-3xl font-bold text-[#1A1C1E]">Access Paused.</h1>
                        <p className="text-gray-500 font-medium leading-relaxed">
                            {managedDevice.isIdentityRevoked
                                ? 'This kitchen screen identity was revoked. Re-pair it from device management.'
                                : (managedDevice.outageAccess.reason ?? 'This kitchen screen needs fresh online authorization.')}
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
        <div className="font-inter tracking-[-0.04em] min-h-screen bg-[#F7F5F2]">
            <Suspense
                fallback={
                    <div className="min-h-screen flex items-center justify-center p-10">
                        <div className="flex flex-col items-center gap-4">
                            <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-[#DDF853]" />
                            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Loading KDS</p>
                        </div>
                    </div>
                }
            >
                <KdsPageContent />
            </Suspense>
        </div>
    );
}
