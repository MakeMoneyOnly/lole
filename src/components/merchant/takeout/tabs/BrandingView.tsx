'use client';

import React from 'react';
import { Palette, Plus, ShoppingBag, CheckCircle2, Truck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandingView(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                            <Palette className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Brand Identity Assets</h3>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                                    Restaurant Logo
                                </label>
                                <div className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/50 transition-all hover:bg-gray-50">
                                    <Plus className="h-8 w-8 text-gray-300" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                                    Theme Color
                                </label>
                                <div className="flex h-[calc(100%-1.5rem)] flex-col gap-3">
                                    <div className="flex flex-1 items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
                                        <div className="bg-brand-accent h-10 w-10 rounded-xl ring-1 ring-black/5" />
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-gray-900">
                                                Primary Accent
                                            </p>
                                            <p className="text-[10px] font-medium text-gray-400">
                                                #DDF853
                                            </p>
                                        </div>
                                    </div>
                                    <button className="rounded-xl border border-gray-100 bg-gray-50 py-2.5 text-xs font-bold text-gray-700 transition-all hover:bg-gray-100">
                                        Change Theme
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                                Hero Banner Image
                            </label>
                            <div className="flex aspect-[21/9] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/50 transition-all hover:bg-gray-50">
                                <Plus className="h-8 w-8 text-gray-300" />
                                <span className="mt-2 text-xs font-bold text-gray-400">
                                    Upload Header Banner (1920x400)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                    <div className="flex items-center gap-3">
                        <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                            <ShoppingBag className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">Guest Menu Layout</h3>
                    </div>

                    <div className="space-y-4">
                        {[
                            {
                                id: 'list',
                                label: 'Classic List View',
                                desc: 'Standard item-by-item list (Toast POS Classic)',
                                active: true,
                            },
                            {
                                id: 'grid',
                                label: 'Visual Grid View',
                                desc: 'High-density grid with large imagery (Mobile-first)',
                            },
                        ].map(layout => (
                            <button
                                key={layout.id}
                                className={cn(
                                    'flex w-full items-center justify-between rounded-2xl border p-5 text-left transition-all outline-none',
                                    layout.active
                                        ? 'border-brand-accent bg-brand-accent/5 ring-brand-accent ring-1'
                                        : 'border-gray-100 bg-gray-50/30 hover:border-gray-200'
                                )}
                            >
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-gray-900">
                                        {layout.label}
                                    </h4>
                                </div>
                                <div
                                    className={cn(
                                        'flex h-5 w-5 items-center justify-center rounded-full border-2',
                                        layout.active
                                            ? 'border-brand-accent bg-brand-accent'
                                            : 'border-gray-200'
                                    )}
                                >
                                    {layout.active && (
                                        <CheckCircle2 className="h-3 w-3 text-black" />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Social Links Section */}
            <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                        <Truck className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Social Presence Links</h3>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {['Instagram', 'Facebook', 'X / Twitter', 'Telegram'].map(platform => (
                        <div key={platform} className="space-y-2">
                            <label className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                                {platform}
                            </label>
                            <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                                <span className="text-xs font-bold text-gray-400">@</span>
                                <input
                                    type="text"
                                    placeholder="username"
                                    className="w-full bg-transparent text-sm font-bold text-gray-900 outline-none"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-8 rounded-3xl border border-gray-100 bg-white p-8 shadow-none">
                <div className="flex items-center gap-3">
                    <div className="bg-brand-accent flex h-10 w-10 items-center justify-center rounded-xl text-black">
                        <Info className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Guest Instructions</h3>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">
                            Pickup Instructions
                        </label>
                        <textarea
                            className="focus:ring-brand-accent h-32 w-full resize-none rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:ring-2"
                            placeholder="e.g. Please park in the designated takeout spots..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-600">
                            Delivery Instructions
                        </label>
                        <textarea
                            className="focus:ring-brand-accent h-32 w-full resize-none rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none focus:ring-2"
                            placeholder="e.g. Call upon arrival at the gate..."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
