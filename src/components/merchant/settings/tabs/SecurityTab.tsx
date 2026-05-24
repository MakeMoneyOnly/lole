import React, { useState } from 'react';
import { Smartphone, Lock, LogOut, Clock, History, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModernSelect } from '../../shared/ModernSelect';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logger';

export function SecurityTab(): React.JSX.Element {
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async (): Promise<void> => {
        try {
            setIsLoggingOut(true);
            const supabase = getSupabaseClient();
            await supabase.auth.signOut();
            router.refresh();
            router.push('/login');
        } catch (err) {
            logger.error('Logout failed', { error: err });
        } finally {
            setIsLoggingOut(false);
        }
    };
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Security & Authentication</h2>
                    <p className="text-sm text-gray-500">
                        Protect your merchant account with Mfa and session management.
                    </p>
                </div>
            </div>

            {/* Critical Protection Section */}
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Mfa with Telebirr */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                <Smartphone className="h-5 w-5" />
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Two-Factor (Mfa)</h3>
                        </div>
                        <span className="rounded-lg bg-green-50 px-2 py-1 text-[10px] font-bold text-green-600">
                            Enabled
                        </span>
                    </div>
                    <div className="space-y-6">
                        <p className="text-xs leading-normal font-medium text-gray-500">
                            Multi-factor authentication is currently linked to your verified
                            Telebirr number ending in{' '}
                            <span className="font-bold text-black">****567</span>.
                        </p>
                        <button className="w-full rounded-xl border border-gray-100 py-3 text-xs font-bold text-gray-900 transition-all hover:bg-gray-50">
                            Change Telebirr Number
                        </button>
                        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                            <div className="flex gap-3">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                                <p className="text-[10px] leading-tight font-semibold text-amber-700">
                                    High-risk actions (Payroll, Financial Products) always require
                                    Mfa verification.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Account Access */}
                <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <Lock className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Access Control</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/30 px-5 py-4">
                            <div>
                                <p className="text-sm font-bold text-gray-900">Dashboard Pin</p>
                                <p className="text-[11px] font-medium text-gray-500">
                                    4-digit code for quick Pos/Dashboard lock.
                                </p>
                            </div>
                            <button className="text-xs font-bold text-blue-600 hover:underline">
                                Set Pin
                            </button>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/30 px-5 py-4">
                            <div>
                                <p className="text-sm font-bold text-gray-900">Session Timeout</p>
                                <p className="text-[11px] font-medium text-gray-500">
                                    Lock dashboard after inactivity.
                                </p>
                            </div>
                            <ModernSelect
                                options={[
                                    { value: '5m', label: '5 minutes' },
                                    { value: '15m', label: '15 minutes' },
                                    { value: '30m', label: '30 minutes' },
                                    { value: '1h', label: '1 hour' },
                                    { value: 'never', label: 'Never' },
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Sessions */}
            <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                            <History className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Logged-in Devices</h3>
                    </div>
                    <button
                        onClick={() => handleLogout()}
                        disabled={isLoggingOut}
                        className={cn(
                            'text-[11px] font-bold text-red-600 transition-colors hover:text-red-700',
                            isLoggingOut && 'cursor-not-allowed opacity-50'
                        )}
                    >
                        {isLoggingOut ? 'Logging out...' : 'Log out of all devices'}
                    </button>
                </div>

                <div className="space-y-4">
                    {[
                        {
                            device: 'MacBook Pro 14" (Current)',
                            location: 'Addis Ababa, ET',
                            time: 'Active now',
                            ip: '197.156.12.XXX',
                        },
                        {
                            device: 'Samsung Galaxy S24 Ultra',
                            location: 'Addis Ababa, ET',
                            time: '2 hours ago',
                            ip: '196.188.1.XXX',
                        },
                    ].map((session, i) => (
                        <div
                            key={i}
                            className="flex items-center justify-between rounded-xl border border-gray-50 bg-gray-50/30 px-6 py-4"
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DDF853] text-black">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900">
                                        {session.device}
                                    </p>
                                    <p className="text-[11px] font-medium text-gray-500">
                                        {session.location} • {session.ip}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-right">
                                <span
                                    className={cn(
                                        'text-[10px] font-bold',
                                        i === 0 ? 'text-green-600' : 'text-gray-400'
                                    )}
                                >
                                    {session.time}
                                </span>
                                {i !== 0 && (
                                    <button
                                        onClick={() => handleLogout()}
                                        disabled={isLoggingOut}
                                        className="rounded-lg border border-gray-100 bg-white p-2 text-gray-400 transition-all hover:text-red-500"
                                    >
                                        <LogOut className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
