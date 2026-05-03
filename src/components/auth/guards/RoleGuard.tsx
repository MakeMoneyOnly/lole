'use client';

import { useRole } from '@/features/auth/hooks/useRole';
import { UserRole } from '@/types/models';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: UserRole[];
    restaurantId?: string; // We need context, usually from URL or global state
    fallback?: React.ReactNode;
}

export function RoleGuard(props: RoleGuardProps) {
    const [isE2EBypass, setIsE2EBypass] = useState(false);

    useEffect(() => {
        if (
            process.env.NODE_ENV !== 'production' &&
            typeof window !== 'undefined' &&
            window.localStorage.getItem('__e2e_bypass_auth') === 'true'
        ) {
            setIsE2EBypass(true);
        }
    }, []);

    if (isE2EBypass) {
        return <>{props.children}</>;
    }

    return <RoleGuardWithAuth {...props} />;
}

function RoleGuardWithAuth({ children, allowedRoles, restaurantId, fallback }: RoleGuardProps) {
    const { role, user, loading } = useRole(restaurantId ?? null);
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        if (!user) {
            router.push('/auth/login');
            return;
        }

        if (!role || !allowedRoles.includes(role)) {
            router.push('/auth/login');
        }
    }, [role, user, loading, allowedRoles, router]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-white">
                <Loader2 className="h-8 w-8 animate-spin text-black" />
            </div>
        );
    }

    if (!user || !role || !allowedRoles.includes(role)) {
        return (
            fallback || (
                <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 p-6 text-center">
                    <h2 className="text-2xl font-bold text-gray-900">Access Denied</h2>
                    <p className="mt-2 text-gray-500">
                        You do not have permission to view this page.
                    </p>
                    <div className="mt-6">
                        <button
                            onClick={() => router.push('/')}
                            className="bg-brand-accent rounded-xl px-6 py-3 text-sm font-bold text-black shadow-lg transition-all hover:brightness-105"
                        >
                            Go Home
                        </button>
                    </div>
                </div>
            )
        );
    }

    return <>{children}</>;
}
