'use client';

import Link from 'next/link';
import { WifiOff, Home, Utensils, RefreshCw } from 'lucide-react';

/**
 * Offline Fallback Page - Client Component
 *
 * Displayed when the user is offline and tries to access a non-cached page.
 * Part of PWA offline-first implementation.
 */
export default function OfflineContent(): React.JSX.Element {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 text-center">
            <div className="mx-auto max-w-md space-y-8">
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-800">
                        <WifiOff className="h-12 w-12 text-neutral-400" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold tracking-tight text-white">You're Offline</h1>

                {/* Description */}
                <p className="text-lg text-neutral-400">
                    Don't worry! Your orders are being saved locally and will sync automatically
                    when you're back online.
                </p>

                {/* Features */}
                <div className="rounded-xl bg-neutral-900 p-6">
                    <h2 className="mb-4 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
                        While you wait
                    </h2>
                    <ul className="space-y-3 text-left text-neutral-300">
                        <li className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20">
                                <Utensils className="h-3 w-3 text-green-500" />
                            </div>
                            <span>View your saved orders</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20">
                                <Utensils className="h-3 w-3 text-green-500" />
                            </div>
                            <span>Browse the cached menu</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20">
                                <Utensils className="h-3 w-3 text-green-500" />
                            </div>
                            <span>Add items to your cart</span>
                        </li>
                    </ul>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700"
                    >
                        <Home className="h-5 w-5" />
                        Go to Home
                    </Link>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-700 px-6 py-3 text-base font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
                    >
                        <RefreshCw className="h-5 w-5" />
                        Try Again
                    </button>
                </div>

                {/* Tip */}
                <p className="text-sm text-neutral-500">
                    Tip: The app works offline! Look for the{' '}
                    <span className="text-neutral-400">pending sync</span> indicator to see queued
                    operations.
                </p>
            </div>
        </div>
    );
}
