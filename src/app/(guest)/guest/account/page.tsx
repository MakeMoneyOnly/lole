'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Check, Loader2, AlertCircle, Shield, Send } from 'lucide-react';
import { createClient } from '@/lib/supabase';

interface GuestProfile {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    is_verified: boolean;
    visit_count: number;
}

function _sanitizeNextPath(rawNext: string | null): string {
    if (!rawNext || rawNext.trim().length === 0) return '/';
    return rawNext.startsWith('/') ? rawNext : '/';
}

function AccountContent(): React.JSX.Element {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [loading, setLoading] = useState(true);
    const [guest, setGuest] = useState<GuestProfile | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [phone, setPhone] = useState('');
    const [savingPhone, setSavingPhone] = useState(false);

    // Verification state
    const [verifying, setVerifying] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationSent, setVerificationSent] = useState(false);
    const [verificationError, setVerificationError] = useState<string | null>(null);
    const [verificationSuccess, setVerificationSuccess] = useState(false);

    useEffect(() => {
        async function fetchGuestProfile(): Promise<void> {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) {
                router.replace('/guest/login');
                return;
            }

            // Find guest by user_id
            const { data: guestData, error: guestError } = await supabase
                .from('guests')
                .select('id, name, email, phone, is_verified, visit_count')
                .eq('user_id', user.id)
                .limit(1)
                .single();

            if (guestError) {
                // If no guest record exists, create one
                if (guestError.code === 'PGRST116') {
                    const { data: newGuest, error: createError } = await supabase
                        .from('guests')
                        .insert({
                            user_id: user.id,
                            email: user.email,
                            name: user.user_metadata?.full_name || null,
                        })
                        .select('id, name, email, phone, is_verified, visit_count')
                        .single();

                    if (createError) {
                        setError('Failed to create profile');
                        setLoading(false);
                        return;
                    }

                    setGuest(newGuest);
                    if (newGuest.phone) setPhone(newGuest.phone);
                } else {
                    setError('Failed to load profile');
                }
            } else {
                setGuest(guestData);
                if (guestData.phone) setPhone(guestData.phone);
            }

            setLoading(false);
        }

        fetchGuestProfile();
    }, [supabase, router]);

    const handleSavePhone = async (): Promise<void> => {
        if (!guest) return;

        setSavingPhone(true);
        setError(null);

        try {
            const { error: updateError } = await supabase
                .from('guests')
                .update({ phone: phone.trim() || null })
                .eq('id', guest.id);

            if (updateError) throw updateError;

            setGuest({ ...guest, phone: phone.trim() || null });
        } catch (_err) {
            setError('Failed to save phone number');
        } finally {
            setSavingPhone(false);
        }
    };

    const handleSendVerification = async (): Promise<void> => {
        if (!guest || (!guest.phone && !phone.trim())) {
            setVerificationError('Please add a phone number first');
            return;
        }

        setVerifying(true);
        setVerificationError(null);

        try {
            const response = await fetch('/api/v1/guest-portal/verify-contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestId: guest.id,
                    channel: 'sms',
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Failed to send verification code');
            }

            setVerificationSent(true);
        } catch (err) {
            setVerificationError(err instanceof Error ? err.message : 'Failed to send code');
        } finally {
            setVerifying(false);
        }
    };

    const handleVerifyCode = async (): Promise<void> => {
        if (!guest || !verificationCode.trim()) return;

        setVerifying(true);
        setVerificationError(null);

        try {
            const response = await fetch('/api/v1/guest-portal/verify-contact', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestId: guest.id,
                    code: verificationCode.trim(),
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'Invalid verification code');
            }

            setVerificationSuccess(true);
            setGuest({ ...guest, is_verified: true });
        } catch (err) {
            setVerificationError(err instanceof Error ? err.message : 'Invalid code');
        } finally {
            setVerifying(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0b1013]">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </div>
        );
    }

    if (error && !guest) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0b1013]">
                <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        <p className="text-sm font-bold text-red-700">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-[#0b1013] px-6 py-12">
            <div className="mx-auto max-w-2xl">
                <div className="mb-8 flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="text-white/60 transition-colors hover:text-white"
                    >
                        ← Back
                    </button>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-white p-8 shadow-xl"
                >
                    <div className="mb-8 flex items-center gap-4">
                        <div className="bg-brand-accent flex h-12 w-12 items-center justify-center rounded-xl">
                            <User className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
                            <p className="text-sm text-gray-500">
                                Manage your profile and contact info
                            </p>
                        </div>
                    </div>

                    {verificationSuccess && (
                        <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                            <Check className="h-5 w-5 text-green-600" />
                            <p className="text-sm font-bold text-green-700">
                                Your contact has been verified!
                            </p>
                        </div>
                    )}

                    {/* Profile Info */}
                    <div className="mb-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Email</label>
                            <div className="relative">
                                <Mail className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="email"
                                    value={guest?.email || ''}
                                    disabled
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-12 py-3.5 text-base font-medium text-gray-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">Phone Number</label>
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Phone className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="+251 912 345 678"
                                        className="focus:border-brand-accent focus:ring-brand-accent/10 w-full rounded-xl border border-gray-200 bg-white px-12 py-3.5 text-base font-medium text-gray-900 outline-none focus:ring-4"
                                    />
                                </div>
                                <button
                                    onClick={handleSavePhone}
                                    disabled={savingPhone || phone === (guest?.phone || '')}
                                    className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-black disabled:opacity-50"
                                >
                                    {savingPhone ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        'Save'
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Verification Status */}
                        <div className="rounded-xl border border-gray-200 p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                                            guest?.is_verified ? 'bg-green-100' : 'bg-yellow-100'
                                        }`}
                                    >
                                        <Shield
                                            className={`h-5 w-5 ${
                                                guest?.is_verified
                                                    ? 'text-green-600'
                                                    : 'text-yellow-600'
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">
                                            Contact Verification
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {guest?.is_verified ? 'Verified' : 'Not verified'}
                                        </p>
                                    </div>
                                </div>
                                {guest?.is_verified && (
                                    <span className="rounded-lg bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                                        VERIFIED
                                    </span>
                                )}
                            </div>

                            {!guest?.is_verified && (
                                <div>
                                    {verificationSent ? (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-bold text-gray-700">
                                                    Enter verification code
                                                </label>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="text"
                                                        value={verificationCode}
                                                        onChange={e =>
                                                            setVerificationCode(
                                                                e.target.value
                                                                    .replace(/\D/g, '')
                                                                    .slice(0, 6)
                                                            )
                                                        }
                                                        placeholder="123456"
                                                        className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-lg font-bold tracking-widest"
                                                        maxLength={6}
                                                    />
                                                    <button
                                                        onClick={handleVerifyCode}
                                                        disabled={
                                                            verifying ||
                                                            verificationCode.length !== 6
                                                        }
                                                        className="bg-brand-accent hover:bg-brand-accent-hover rounded-xl px-6 py-3 text-sm font-bold text-black transition-all disabled:opacity-50"
                                                    >
                                                        {verifying ? (
                                                            <Loader2 className="h-5 w-5 animate-spin" />
                                                        ) : (
                                                            'Verify'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            {verificationError && (
                                                <p className="text-sm text-red-600">
                                                    {verificationError}
                                                </p>
                                            )}
                                            <button
                                                onClick={handleSendVerification}
                                                disabled={verifying}
                                                className="text-sm text-gray-500 underline hover:text-gray-700"
                                            >
                                                Resend code
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleSendVerification}
                                            disabled={verifying || !phone.trim()}
                                            className="hover:text-black-hover flex items-center gap-2 text-sm font-bold text-black"
                                        >
                                            <Send className="h-4 w-4" />
                                            {verifying ? 'Sending...' : 'Send verification code'}
                                        </button>
                                    )}
                                    {verificationError && !verificationSent && (
                                        <p className="mt-2 text-sm text-red-600">
                                            {verificationError}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="rounded-xl bg-gray-50 p-6">
                        <p className="mb-2 text-sm font-bold text-gray-500">Your Activity</p>
                        <p className="text-2xl font-bold text-gray-900">
                            {guest?.visit_count || 0} visits
                        </p>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}

export default function GuestAccountPage(): React.JSX.Element {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-[#0b1013]">
                    <Loader2 className="h-8 w-8 animate-spin text-white/50" />
                </div>
            }
        >
            <AccountContent />
        </Suspense>
    );
}



