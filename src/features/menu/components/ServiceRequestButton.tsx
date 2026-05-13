'use client';

import { Bell, HandPlatter, Receipt } from 'lucide-react';
import { useHaptic } from '@/hooks/useHaptic';
import { Drawer } from 'vaul';
import { useState } from 'react';

interface ServiceRequestButtonProps {
    guestContext: {
        slug: string;
        table: string;
        sig: string;
        exp: number;
    } | null;
    tableNumber: string | null;
}

export function ServiceRequestButton({ guestContext, tableNumber }: ServiceRequestButtonProps) {
    const { trigger } = useHaptic();
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const submitRequest = async (requestType: 'waiter' | 'bill') => {
        if (!guestContext || !tableNumber) {
            setError('Unable to send request: invalid or expired table QR context.');
            return;
        }

        setSubmitting(true);
        setMessage(null);
        setError(null);

        try {
            const response = await fetch('/api/v1/merchant/operations/service-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guest_context: guestContext,
                    request_type: requestType,
                }),
            });

            const payload = await response.json();
            if (!response.ok) {
                setError(payload?.error ?? 'Request failed. Please try again.');
                return;
            }

            trigger('success');
            setMessage(requestType === 'bill' ? 'Bill requested.' : 'Waiter has been notified.');
            setOpen(false);
        } catch (requestError) {
            console.error('Service request failed:', requestError);
            setError('Network error while sending request.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <button
                onClick={() => {
                    trigger('medium');
                    setOpen(true);
                }}
                className="bg-brand-accent fixed bottom-6 left-6 z-40 flex h-16 w-16 touch-manipulation items-center justify-center rounded-full text-black shadow-2xl transition-transform active:scale-90"
            >
                <Bell size={24} fill="currentColor" />
            </button>

            <Drawer.Root open={open} onOpenChange={setOpen}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 z-[9999] bg-black/40" />
                    <Drawer.Content className="pb-safe fixed right-0 bottom-0 left-0 z-[9999] mt-24 flex flex-col rounded-t-[32px] bg-white p-6 outline-none">
                        <div className="mx-auto mb-8 h-1.5 w-12 flex-shrink-0 rounded-full bg-gray-300" />

                        <Drawer.Title className="font-manrope mb-6 text-center text-2xl font-black">
                            Service Request
                        </Drawer.Title>

                        <div className="mb-4 flex flex-col gap-4">
                            <button
                                disabled={submitting}
                                onClick={() => submitRequest('waiter')}
                                className="bg-surface-1 flex h-16 w-full items-center justify-center gap-3 rounded-xl text-lg font-bold transition-transform hover:bg-gray-100 active:scale-95"
                            >
                                <HandPlatter size={24} className="text-black" />
                                Call for a Waiter
                            </button>

                            <button
                                disabled={submitting}
                                onClick={() => submitRequest('bill')}
                                className="bg-surface-1 flex h-16 w-full items-center justify-center gap-3 rounded-xl text-lg font-bold transition-transform hover:bg-gray-100 active:scale-95"
                            >
                                <Receipt size={24} className="text-black" />
                                Ask for a Bill
                            </button>

                            {message && (
                                <p className="text-center text-sm font-semibold text-green-600">
                                    {message}
                                </p>
                            )}
                            {error && (
                                <p className="text-center text-sm font-semibold text-red-600">
                                    {error}
                                </p>
                            )}
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>
        </>
    );
}
