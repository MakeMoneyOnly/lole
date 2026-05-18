'use client';

import React from 'react';
import { Kanban, Zap, ShoppingBag, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PartnerStatusView(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 pb-12 duration-500">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {[
                    {
                        name: 'Glovo',
                        status: 'Healthy',
                        icon: Kanban,
                        color: 'emerald',
                        latency: '120ms',
                    },
                    {
                        name: 'Cheetah',
                        status: 'Healthy',
                        icon: Zap,
                        color: 'emerald',
                        latency: '85ms',
                    },
                    {
                        name: 'Telegram Bot',
                        status: 'Snoozed',
                        icon: ShoppingBag,
                        color: 'orange',
                        latency: 'N/A',
                    },
                ].map(partner => (
                    <div
                        key={partner.name}
                        className="group hover:border-brand-accent/50 flex flex-col gap-6 rounded-3xl border border-gray-100 bg-white p-8 shadow-none transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className={cn(
                                        'flex h-10 w-10 items-center justify-center rounded-xl text-black',
                                        partner.color === 'emerald'
                                            ? 'bg-emerald-100 text-emerald-600'
                                            : 'bg-orange-100 text-orange-600'
                                    )}
                                >
                                    <partner.icon className="h-5 w-5" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">{partner.name}</h3>
                            </div>
                            <div className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-gray-100 transition-colors">
                                <div
                                    className={cn(
                                        'absolute h-3 w-3 rounded-full bg-white transition-all',
                                        partner.status === 'Healthy' ? 'right-1' : 'left-1'
                                    )}
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs font-semibold">
                                <span className="tracking-wider text-gray-400 uppercase">
                                    Sync Latency
                                </span>
                                <span className="text-gray-900">{partner.latency}</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-50">
                                <div
                                    className={cn(
                                        'h-full transition-all',
                                        partner.status === 'Healthy'
                                            ? 'w-full bg-emerald-500'
                                            : 'w-0 bg-gray-200'
                                    )}
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                            <div className="flex items-center gap-2">
                                <div
                                    className={cn(
                                        'h-1.5 w-1.5 rounded-full',
                                        partner.color === 'emerald'
                                            ? 'bg-emerald-500'
                                            : 'bg-orange-500'
                                    )}
                                />
                                <span className="text-xs font-bold text-gray-500">
                                    {partner.status}
                                </span>
                            </div>
                            <button className="rounded-lg p-2 text-gray-400 transition-all hover:bg-gray-50 hover:text-black">
                                <Settings2 className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
