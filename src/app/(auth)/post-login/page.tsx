'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/Skeleton';

export default function PostLoginPage(): React.JSX.Element {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    const [message, setMessage] = useState('Finalizing your session...');

    useEffect(() => {
        let cancelled = false;

        async function finalize(): Promise<void> {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (cancelled) return;

                if (!user) {
                    setMessage('Session not found. Redirecting to login...');
                    router.replace('/login');
                    return;
                }

                setMessage('Setting up your workspace...');

                // Get the user's staff record and the associated restaurant's onboarding status
                const staffResult = await supabase
                    .rpc('get_my_staff_role', { p_restaurant_id: null })
                    .maybeSingle();
                const staff = staffResult.data as { role: string; restaurant_id: string } | null;

                if (cancelled) return;

                if (!staff?.restaurant_id) {
                    // No restaurant at all — shouldn't happen due to DB trigger, but handle it
                    router.replace('/merchant/onboarding');
                    return;
                }

                // Check if the restaurant has completed the onboarding wizard
                const { data: restaurant } = await supabase
                    .from('restaurants')
                    .select('onboarding_completed')
                    .eq('id', staff.restaurant_id)
                    .maybeSingle();

                if (cancelled) return;

                if (!restaurant?.onboarding_completed) {
                    // Auto-bootstrapped but wizard not completed → send to onboarding
                    router.replace('/merchant/onboarding');
                    return;
                }

                // Fully onboarded — route by role
                if (staff.role === 'kitchen' || staff.role === 'bar') {
                    router.replace('/kds/display');
                } else if (staff.role === 'waiter') {
                    router.replace('/waiter');
                } else {
                    router.replace('/merchant');
                }
            } catch {
                if (cancelled) return;
                router.replace('/login');
            }
        }

        void finalize();
        return () => {
            cancelled = true;
        };
    }, [router, supabase]);

    return (
        <main className="flex min-h-screen items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl" />
                <Skeleton className="h-4 w-48 rounded-lg" />
                <p className="font-manrope mt-2 text-xs font-semibold text-gray-400">{message}</p>
            </div>
        </main>
    );
}
