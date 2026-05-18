'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Eye, EyeOff, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase';

function sanitizeNextPath(rawNext: string | null): string {
    if (!rawNext || rawNext.trim().length === 0) return '/';
    return rawNext.startsWith('/') ? rawNext : '/';
}

function getAuthErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message.length > 0) return message;
    }
    return 'Unable to create account. Please try again.';
}

function SignUpContent(): React.JSX.Element {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = useMemo(() => createClient(), []);
    const nextPath = sanitizeNextPath(searchParams.get('next'));

    const handleSubmit = async (event: React.FormEvent): Promise<void> => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const returnTarget = `/guest/post-login?next=${encodeURIComponent(nextPath)}`;
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        account_type: 'guest',
                        full_name: fullName.trim() || undefined,
                    },
                    emailRedirectTo:
                        typeof window !== 'undefined'
                            ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTarget)}`
                            : undefined,
                },
            });

            if (signUpError) throw signUpError;

            // Create guest record with phone if provided
            if (data.user) {
                const phoneNumber = phone.trim();
                const emailAddress = email.trim();

                if (phoneNumber || emailAddress) {
                    // Get restaurant_id from the URL or use default
                    const restaurantId = searchParams.get('restaurant_id') || null;

                    const { error: guestError } = await supabase.from('guests').insert({
                        user_id: data.user.id,
                        name: fullName.trim() || null,
                        phone: phoneNumber || null,
                        email: emailAddress,
                        restaurant_id: restaurantId,
                        is_verified: false,
                    });

                    if (guestError) {
                        console.error('Error creating guest record:', guestError);
                    }
                }

                router.push(returnTarget);
                router.refresh();
                return;
            }

            setMessage('Account created. Confirm your email, then continue to your table menu.');
        } catch (submitError) {
            const parsedMessage = getAuthErrorMessage(submitError);
            if (/already registered/i.test(parsedMessage)) {
                setError('This email is already registered. Please sign in.');
            } else {
                setError(parsedMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
            <section className="relative flex flex-col items-center justify-center bg-white px-6 py-12 lg:px-12">
                <Link
                    href="/"
                    className="absolute top-8 left-8 flex h-8 w-24 items-center pl-1 lg:top-12 lg:left-12"
                >
                    <Image
                        src="/logo-black.svg"
                        alt="Lole"
                        width={96}
                        height={90}
                        className="pointer-events-none absolute top-1/2 left-0 h-[74px] w-auto max-w-none origin-left -translate-y-1/2 md:h-[90px]"
                        priority
                    />
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="w-full max-w-[440px]"
                >
                    <h1 className="font-manrope text-center text-4xl font-bold tracking-tight text-black lg:text-left">
                        Create Guest Account
                    </h1>
                    <p className="font-manrope mt-3 text-center text-base leading-relaxed font-medium text-black/60 lg:text-left">
                        Save loyalty points and gift cards for every future order.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        {error ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                                {error}
                            </div>
                        ) : null}
                        {message ? (
                            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
                                {message}
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-black/80">Name</label>
                            <div className="group relative">
                                <User className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-black/40 transition-colors group-focus-within:text-black" />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="Enter your name (optional)"
                                    className="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-black/80">Email</label>
                            <div className="group relative">
                                <Mail className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-black/40 transition-colors group-focus-within:text-black" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    className="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-black/80">
                                Phone Number (Optional)
                            </label>
                            <div className="group relative">
                                <Phone className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-black/40 transition-colors group-focus-within:text-black" />
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="+251 912 345 678"
                                    className="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"
                                />
                            </div>
                            <p className="text-xs font-medium text-black/50">
                                For SMS notifications about your orders and exclusive offers
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-black/80">Password</label>
                            <div className="group relative">
                                <Lock className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-black/40 transition-colors group-focus-within:text-black" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Create a password"
                                    className="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 pr-14 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"
                                    minLength={6}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(prev => !prev)}
                                    className="absolute top-1/2 right-4 -translate-y-1/2 text-black/40 transition hover:text-black/70"
                                    aria-label="Toggle password visibility"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            whileHover={{ scale: 1.01 }}
                            disabled={loading}
                            type="submit"
                            className="group font-manrope bg-brand-accent focus:ring-brand-accent/20 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-lg font-bold text-black transition-all hover:brightness-105 focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </motion.button>
                    </form>

                    <p className="mt-8 text-center text-sm font-bold text-black/60">
                        Already have an account?{' '}
                        <Link
                            href={`/guest/login?next=${encodeURIComponent(nextPath)}`}
                            className="hover:text-black-hover text-black hover:underline"
                        >
                            Sign In
                        </Link>
                    </p>
                    <p className="mt-3 text-center text-xs font-bold text-black/50">
                        <Link
                            href={nextPath}
                            className="underline underline-offset-4 hover:text-black"
                        >
                            Back to Menu
                        </Link>
                    </p>
                </motion.div>
            </section>

            <section className="relative hidden w-full flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_right,#1A1A1A_0%,#090909_45%,#000000_100%)] p-12 text-white lg:flex xl:p-24">
                <div className="bg-brand-accent/10 absolute top-0 right-0 h-[500px] w-[500px] rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-white/5 blur-[120px]" />
                <div className="relative z-10" />
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="relative z-10 my-auto"
                >
                    <h2 className="font-manrope text-5xl leading-[1.1] font-bold tracking-tight text-white">
                        One account for every Lole table
                    </h2>
                    <div className="border-brand-accent mt-8 border-l-2 pl-6">
                        <p className="text-xl leading-relaxed font-medium text-white/90 italic">
                            &ldquo;I sign up once, then every scan at participating restaurants
                            keeps my rewards in sync.&rdquo;
                        </p>
                        <div className="mt-6 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-white/10" />
                            <div>
                                <p className="text-base font-bold text-white">Lole Rewards</p>
                                <p className="text-sm font-medium text-white/50">
                                    Guest Membership
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>
        </main>
    );
}

import { Suspense } from 'react';

export default function GuestSignUpPage(): React.JSX.Element {
    return (
        <Suspense fallback={null}>
            <SignUpContent />
        </Suspense>
    );
}



