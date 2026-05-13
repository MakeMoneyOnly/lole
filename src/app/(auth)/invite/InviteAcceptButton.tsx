'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { acceptInvite } from '@/app/auth/invite/actions';

export function InviteAcceptButton({ code }: { code: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleAccept = async () => {
        try {
            setLoading(true);
            const result = await acceptInvite(code);

            if (result?.error) {
                toast.error(result.error);
            } else {
                toast.success('Invitation accepted! Setting up profile...');
                router.push('/merchant/onboarding/staff');
            }
        } catch (e) {
            toast.error('An unexpected error occurred. Please try again.');
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-blue-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
            {loading ? 'Accepting...' : 'Accept Invitation'}
        </button>
    );
}
