'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

function WaiterPinContent(): React.JSX.Element {
    const router = useRouter();
    const searchParams = useSearchParams();
    const restaurantId = searchParams.get('restaurantId');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!restaurantId) {
            router.push('/login');
        }
    }, [restaurantId, router]);

    const handleNumberClick = (num: number): void => {
        if (pin.length < 4) {
            setPin(prev => prev + num);
        }
    };

    const handleDelete = (): void => {
        setPin(prev => prev.slice(0, -1));
    };

    const handleSubmit = useCallback(async (): Promise<void> => {
        if (pin.length !== 4) return;
        setLoading(true);

        try {
            const res = await fetch('/api/v1/merchant/core/staff/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ restaurantId, pin }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Invalid PIN');
            }

            sessionStorage.setItem('gebata_waiter_context', JSON.stringify(data.data.staff));
            toast.success(`Welcome, ${data.data.staff.name || 'Waitstaff'}`);
            router.push(`/waiter?restaurantId=${restaurantId}`);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Verification failed');
            setPin('');
        } finally {
            setLoading(false);
        }
    }, [pin, restaurantId, router]);

    useEffect(() => {
        if (pin.length === 4) {
            void handleSubmit();
        }
    }, [pin, handleSubmit]);

    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

    return (
        <main className="font-inter tracking-[-0.04em] flex min-h-screen flex-col items-center justify-center bg-[#F7F5F2] px-6 antialiased">
            <div className="w-full max-w-[440px] bg-white border border-gray-100 rounded-[2rem] p-12">
                <div className="mb-10 flex flex-col items-center text-center">
                    <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#F7F5F2] text-[#1A1C1E]">
                        <ShieldCheck className="h-10 w-10" />
                    </div>
                    <h1 className="text-4xl font-bold text-[#1A1C1E] leading-none mb-4">
                        Terminal Locked.
                    </h1>
                    <p className="text-gray-500 font-medium text-lg leading-relaxed">
                        Enter your 4-digit staff PIN <br /> to resume service.
                    </p>
                </div>

                <div className="mb-12 flex justify-center gap-5">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 transition-all duration-300 ${
                                i < pin.length
                                    ? 'border-[#1A1C1E] bg-[#1A1C1E]'
                                    : 'border-gray-100 bg-[#F7F5F2]'
                            }`}
                        >
                            {i < pin.length && (
                                <div className="h-3 w-3 rounded-full bg-[#DDF853] animate-pulse" />
                            )}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    {numbers.map(num => (
                        <button
                            key={num}
                            onClick={() => handleNumberClick(num)}
                            disabled={loading || pin.length >= 4}
                            className="flex h-20 items-center justify-center rounded-2xl border border-gray-100 bg-white text-3xl font-bold text-[#1A1C1E] transition-all hover:bg-[#F7F5F2] active:scale-95 disabled:opacity-50"
                        >
                            {num}
                        </button>
                    ))}
                    <div className="flex items-center justify-center" />
                    <button
                        onClick={() => handleNumberClick(0)}
                        disabled={loading || pin.length >= 4}
                        className="flex h-20 items-center justify-center rounded-2xl border border-gray-100 bg-white text-3xl font-bold text-[#1A1C1E] transition-all hover:bg-[#F7F5F2] active:scale-95 disabled:opacity-50"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={loading || pin.length === 0}
                        className="flex h-20 items-center justify-center rounded-2xl border border-transparent bg-[#F7F5F2] text-sm font-black uppercase tracking-widest text-gray-400 transition-all hover:text-red-500 active:scale-95 disabled:opacity-30"
                    >
                        Clear
                    </button>
                </div>

                {loading && (
                    <div className="mt-10 flex flex-col items-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-[#DDF853]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Verifying Identity</span>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function WaiterPinPage(): React.JSX.Element {
    return (
        <Suspense
            fallback={
                <main className="font-inter tracking-[-0.04em] flex min-h-screen items-center justify-center bg-[#F7F5F2]">
                    <div className="flex flex-col items-center gap-4">
                        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-[#DDF853]" />
                        <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Loading Terminal</p>
                    </div>
                </main>
            }
        >
            <WaiterPinContent />
        </Suspense>
    );
}

