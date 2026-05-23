'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { logger } from '@/lib/logger';

export const LoginForm = (): React.JSX.Element => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // We instantiate the client here
    const supabase = createClient();
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;
            if (!data.user) throw new Error('No user returned');

            // Fetch role to determine redirection
            // Since we can't use the hook easily inside this async handler for immediate one-off logic,
            // we query manually similar to the hook logic.

            const { data: staffData, error: roleError } = await supabase
                .from('restaurant_staff')
                .select('role')
                .eq('user_id', data.user.id)
                .maybeSingle();

            if (roleError) {
                logger.error('Role fetch error:', roleError);
                router.push('/merchant');
                return;
            }

            const role = staffData?.role;

            if (role === 'kitchen' || role === 'bar') {
                router.push('/kds/display');
            } else if (role === 'waiter') {
                router.push('/waiter');
            } else {
                router.push('/merchant');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card.Root asChild className="w-full max-w-md">
            <div className="bg-surface-0/80 border-surface-200 border p-8 shadow-2xl backdrop-blur-xl">
                <Card.Header>
                    <div className="mb-8 text-center">
                        <Card.Title asChild>
                            <h1 className="mb-2 text-3xl font-bold text-black">lole</h1>
                        </Card.Title>
                        <Card.Description>Restaurant Operations Platform</Card.Description>
                    </div>
                </Card.Header>

                <Card.Content>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-text-primary text-sm font-medium">Email</label>
                            <div className="relative">
                                <Mail className="text-text-tertiary absolute top-3 left-3 h-5 w-5" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="border-surface-200 bg-surface-50 text-text-primary focus:border-brand-accent focus:ring-brand-accent w-full rounded-lg border py-2.5 pr-4 pl-10 transition-all outline-none focus:ring-1"
                                    placeholder="name@restaurant.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-text-primary text-sm font-medium">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="text-text-tertiary absolute top-3 left-3 h-5 w-5" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="border-surface-200 bg-surface-50 text-text-primary focus:border-brand-accent focus:ring-brand-accent w-full rounded-lg border py-2.5 pr-12 pl-10 transition-all outline-none focus:ring-1"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="text-text-tertiary hover:text-text-primary absolute top-3 right-3"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5" />
                                    ) : (
                                        <Eye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-medium text-red-600">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="bg-brand-accent hover:bg-brand-accent-hover shadow-brand-accent/20 h-12 w-full text-lg font-bold text-black shadow-lg"
                            isLoading={loading}
                        >
                            Sign In
                        </Button>
                    </form>
                </Card.Content>

                <Card.Footer>
                    <div className="mt-6 text-center">
                        <a
                            href="#"
                            className="text-text-tertiary text-sm transition-colors hover:text-black"
                        >
                            Forgot your password?
                        </a>
                    </div>
                </Card.Footer>
            </div>
        </Card.Root>
    );
};
