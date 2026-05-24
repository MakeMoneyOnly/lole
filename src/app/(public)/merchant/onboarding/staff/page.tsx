'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'react-hot-toast';

export default function OnboardingPage(): React.JSX.Element {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');

    useEffect(() => {
        const fetchUser = async (): Promise<void> => {
            setLoading(true);
            const supabase = createClient();
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/login');
                return;
            }

            // Check for owner role
            const { data: staff } = await supabase
                .from('restaurant_staff')
                .select('role')
                .eq('user_id', user.id)
                .maybeSingle();

            if (staff?.role === 'owner') {
                // Owners should not see this page, redirect to dashboard
                router.replace('/merchant/dashboard');
                return;
            }

            const currentName = user.user_metadata?.full_name || user.user_metadata?.name || '';
            // If name is "Owner", we treat it as not set for invitees
            if (currentName && currentName !== 'Owner') {
                setName(currentName);
            }
            setLoading(false);
        };
        fetchUser();
    }, [router]);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setLoading(true);

        try {
            const supabase = createClient();
            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: name,
                    name: name,
                    first_name: name.split(' ')[0],
                    last_name: name.split(' ').slice(1).join(' '),
                },
            });

            if (error) throw error;

            toast.success('Profile updated!');
            // Force a hard refresh/navigation to ensure the session update is picked up by server components
            window.location.href = '/merchant/staff/schedule';
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'An error occurred';
            toast.error(message);
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-900">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 dark:bg-zinc-900">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Welcome!</h1>
                <p className="mb-6 text-gray-600 dark:text-gray-400">
                    Let's set up your profile. How should we call you?
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label
                            htmlFor="name"
                            className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                            Check Display Name
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Abebe Kebede"
                            className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-zinc-700 dark:text-white"
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            This name will be visible to other staff members.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !name}
                        className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-blue-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {loading ? 'Saving...' : 'Continue to Dashboard'}
                    </button>
                </form>
            </div>
        </div>
    );
}
