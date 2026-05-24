'use client';

import { useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/Skeleton';

function sanitizeNextPath(rawNext: string | null): string {
    if (!rawNext || rawNext.trim().length === 0) return '/';
    return rawNext.startsWith('/') ? rawNext : '/';
}

function PostLoginContent(): React.JSX.Element {
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createClient(), []);

    useEffect(() => {
        let cancelled = false;

        async function finalizeGuestLogin(): Promise<void> {
            const nextPath = sanitizeNextPath(searchParams.get('next'));
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (cancelled) return;

            if (!user) {
                router.replace(`/guest/login?next=${encodeURIComponent(nextPath)}`);
                return;
            }

            router.replace(nextPath);
        }

        void finalizeGuestLogin();
        return () => {
            cancelled = true;
        };
    }, [router, searchParams, supabase]);

    return (
        <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl bg-white/20" />
            <p className="text-xs font-bold tracking-[0.2em] text-white/60 uppercase">
                Finishing sign in
            </p>
        </div>
    );
}

export default function GuestPostLoginPage(): React.JSX.Element {
    return (
        <main className="flex min-h-screen items-center justify-center bg-[#0b1013] text-white">
            <Suspense
                fallback={
                    <div className="flex flex-col items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl bg-white/20" />
                        <p className="text-xs font-bold tracking-[0.2em] text-white/60 uppercase">
                            Loading...
                        </p>
                    </div>
                }
            >
                <PostLoginContent />
            </Suspense>
        </main>
    );
}
