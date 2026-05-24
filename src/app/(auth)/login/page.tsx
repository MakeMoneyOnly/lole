'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase';

function getAuthErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error && 'message' in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message.length > 0) return message;
    }
    return 'Unable to sign in. Please try again.';
}
export default function LoginPage(): React.ReactElement {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [oauthMessage, setOauthMessage] = useState<string | null>(null);
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setOauthMessage(null);

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (signInError) throw signInError;
            if (!data.user) throw new Error('No authenticated user returned.');

            // Non-blocking role check: login success should not fail because of staff query parsing issues.
            const { data: staff } = await supabase
                .from('restaurant_staff')
                .select('role')
                .eq('user_id', data.user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (staff?.role === 'kitchen') {
                router.push('/post-login');
            } else {
                router.push('/post-login');
            }
            router.refresh();
        } catch (submitError) {
            const message = getAuthErrorMessage(submitError);
            if (/email.*confirm/i.test(message)) {
                setError('Please confirm your email first, then sign in.');
            } else if (/invalid login credentials/i.test(message)) {
                setError('Incorrect email or password.');
            } else {
                setError(message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
            {/* Left Section: Form */}
            <section className="relative flex flex-col items-center justify-center bg-white px-6 py-12 lg:px-12">
                {/* Logo - Pinned Top Left */}
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
                        style={{ width: 'auto' }}
                        priority
                    />
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="w-full max-w-[440px]"
                >
                    <h1 className="font-manrope text-center text-4xl font-bold tracking-tight text-black lg:text-left lg:text-4xl">
                        Welcome Back!
                    </h1>
                    <p className="font-manrope mt-3 text-center text-base leading-relaxed font-medium text-black/60 lg:text-left">
                        Sign in to access your dashboard and continue managing your restaurant.
                    </p>

                    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                        {error && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                                {error}
                            </div>
                        )}
                        {oauthMessage && (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                                {oauthMessage}
                            </div>
                        )}

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
                            <label className="text-sm font-bold text-black/80">Password</label>
                            <div className="group relative">
                                <Lock className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-black/40 transition-colors group-focus-within:text-black" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="font-manrope focus:border-brand-accent focus:ring-brand-accent/5 focus:shadow-brand-accent/10 w-full rounded-xl border border-black/15 bg-white px-12 py-3.5 pr-14 text-base font-medium text-black transition-all outline-none placeholder:text-black/30 focus:shadow-lg focus:ring-4"
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

                        <div className="flex justify-end">
                            <Link
                                href="#"
                                className="hover:text-black-hover text-sm font-bold text-black"
                            >
                                Forgot Password?
                            </Link>
                        </div>

                        <motion.button
                            whileTap={{ scale: 0.98 }}
                            whileHover={{ scale: 1.01 }}
                            disabled={loading}
                            type="submit"
                            className="group font-manrope bg-brand-accent focus:ring-brand-accent/20 flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-lg font-bold text-black transition-all hover:brightness-105 focus:ring-4 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {loading ? 'Signing In...' : 'Sign In'}
                        </motion.button>
                    </form>

                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-gray-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white px-3 font-bold tracking-wider text-gray-400">
                                OR
                            </span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button className="font-manrope flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-black transition-all hover:bg-gray-50 focus:ring-4 focus:ring-gray-100">
                            <svg className="h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Continue with Google
                        </button>
                        <button className="font-manrope flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-bold text-black transition-all hover:bg-gray-50 focus:ring-4 focus:ring-gray-100">
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74 1.18 0 2.45-1.62 4.75-1.42 1.05.06 2.07.51 2.76 1.15-2.51 1.55-2.06 5.51.5 6.64-.53 1.56-1.52 3.14-3.09 5.86zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                            </svg>
                            Continue with Apple
                        </button>
                    </div>

                    <p className="mt-8 text-center text-sm font-bold text-black/60">
                        Don&apos;t have an Account?{' '}
                        <Link
                            href="/signup"
                            className="hover:text-black-hover text-black hover:underline"
                        >
                            Sign Up
                        </Link>
                    </p>
                </motion.div>
            </section>

            {/* Right Section: Brand Panel */}
            <section className="relative hidden w-full flex-col justify-between overflow-hidden bg-[radial-gradient(circle_at_top_right,#1A1A1A_0%,#090909_45%,#000000_100%)] p-12 text-white lg:flex xl:p-24">
                <div className="bg-brand-accent/10 absolute top-0 right-0 h-[500px] w-[500px] rounded-full blur-[120px]" />
                <div className="absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-white/5 blur-[120px]" />

                {/* Spacer for layout balance */}
                <div className="relative z-10" />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    className="relative z-10 my-auto"
                >
                    <h2 className="font-manrope text-5xl leading-[1.1] font-bold tracking-tight text-white xl:text-5xl">
                        Revolutionize your Restaurant with Smarter Automation
                    </h2>
                    <div className="border-brand-accent mt-8 border-l-2 pl-6">
                        <p className="text-xl leading-relaxed font-medium text-white/90 italic">
                            &ldquo;Lole has completely transformed our service process. It&apos;s
                            reliable, efficient, and ensures our tables are always turning
                            fast.&rdquo;
                        </p>
                        <div className="mt-6 flex items-center gap-4">
                            <div className="h-12 w-12 rounded-full bg-white/10" />
                            <div>
                                <p className="text-base font-bold text-white">Michael Carter</p>
                                <p className="text-sm font-medium text-white/50">
                                    General Manager at DevCore
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="relative z-10 mt-12 border-t border-white/10 pt-8"
                >
                    <div className="grid grid-cols-4 gap-8 opacity-50 grayscale transition-all hover:opacity-100 hover:grayscale-0">
                        {/* Mock Logos */}
                        <div className="flex items-center gap-2 text-lg font-bold">
                            <div className="h-6 w-6 rounded bg-white/20" /> Discord
                        </div>
                        <div className="flex items-center gap-2 text-lg font-bold">
                            <div className="h-6 w-6 rounded bg-white/20" /> Mailchimp
                        </div>
                        <div className="flex items-center gap-2 text-lg font-bold">
                            <div className="h-6 w-6 rounded bg-white/20" /> Grammarly
                        </div>
                        <div className="flex items-center gap-2 text-lg font-bold">
                            <div className="h-6 w-6 rounded bg-white/20" /> Dropbox
                        </div>
                    </div>
                </motion.div>
            </section>
        </main>
    );
}
