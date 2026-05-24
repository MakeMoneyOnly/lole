import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { InviteAcceptButton } from './InviteAcceptButton';
import { verifyOrigin } from '@/lib/security/csrf';

export default async function InvitePage(props: {
    searchParams: Promise<{ code: string }>;
}): Promise<React.ReactElement> {
    const searchParams = await props.searchParams;
    const { code } = searchParams;

    if (!code) {
        redirect('/');
    }

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Fetch Invite Details
    const { data: invite, error } = await supabase
        .from('staff_invites')
        .select(
            `
            *,
            restaurant:restaurants (
                name
            )
        `
        )
        .eq('code', code)
        .single();

    if (error || !invite) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center dark:bg-zinc-900">
                <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                    <h1 className="mb-2 text-2xl font-bold text-red-600">Invalid Invite</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        This invite link is invalid or has expired.
                    </p>
                    <Link
                        href="/"
                        className="bg-brand-accent mt-6 inline-block rounded-lg px-6 py-2 text-sm font-medium text-black transition hover:brightness-105 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                        Go Home
                    </Link>
                </div>
            </div>
        );
    }

    const restaurantName = invite.restaurant?.name ?? 'Unknown Restaurant';
    const isExpired = new Date(invite.expires_at) < new Date();
    const isUsed = invite.status !== 'pending';

    if (isExpired || isUsed) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-center dark:bg-zinc-900">
                <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                    <h1 className="mb-2 text-2xl font-bold text-red-600">Invite No Longer Valid</h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        {isUsed ? 'This invite has already been used.' : 'This invite has expired.'}
                    </p>
                    <Link
                        href="/"
                        className="bg-brand-accent mt-6 inline-block rounded-lg px-6 py-2 text-sm font-medium text-black transition hover:brightness-105 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                    >
                        Go Home
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 dark:bg-zinc-900">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                <div className="p-8 text-center">
                    <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl dark:bg-blue-900/20">
                        👋
                    </div>

                    <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
                        You&apos;ve been invited!
                    </h1>

                    <p className="mb-6 text-gray-600 dark:text-gray-400">
                        Join{' '}
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {restaurantName}
                        </span>{' '}
                        as a{' '}
                        <span className="font-medium text-blue-600 capitalize dark:text-blue-400">
                            {invite.role}
                        </span>
                        .
                    </p>

                    {user ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Logged in as{' '}
                                <span className="font-medium text-gray-900 dark:text-white">
                                    {user.email}
                                </span>
                            </p>

                            <InviteAcceptButton code={code} />

                            <form
                                action={async () => {
                                    'use server';
                                    await verifyOrigin();
                                    const supabase = await createClient();
                                    await supabase.auth.signOut();
                                    redirect(`/login?next=/invite?code=${code}`);
                                }}
                            >
                                <button className="text-sm text-gray-500 hover:text-gray-900 hover:underline dark:text-gray-400 dark:hover:text-white">
                                    Not you? Switch account
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <Link
                                href={`/login?next=/invite?code=${code}`}
                                className="bg-brand-accent block w-full rounded-xl py-3 text-center text-sm font-semibold text-black shadow-lg transition-all hover:shadow-gray-500/20 hover:brightness-105 active:scale-[0.98] dark:bg-white dark:text-black dark:hover:bg-gray-200"
                            >
                                Log in to Accept
                            </Link>
                            <Link
                                href={`/signup?next=/invite?code=${code}`}
                                className="block w-full rounded-xl border border-gray-200 bg-white py-3 text-center text-sm font-semibold text-gray-900 transition-all hover:bg-gray-50 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                            >
                                Create Account
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
