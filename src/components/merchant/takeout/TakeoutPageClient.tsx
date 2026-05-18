'use client';

import React, { useState } from 'react';
import {
    ShoppingBag,
    Clock,
    Settings,
    Kanban,
    Palette,
    Truck,
    CheckCircle2,
    PauseCircle,
    PlayCircle,
    Save,
    ChevronDown,
    Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardView } from './tabs/DashboardView';
import { AvailabilityView } from './tabs/AvailabilityView';
import { PartnerStatusView } from './tabs/PartnerStatusView';
import { BrandingView } from './tabs/BrandingView';
import { ConnectionsView } from './tabs/ConnectionsView';
import { HoursView } from './tabs/HoursView';
import { StrategiesView } from './tabs/StrategiesView';

// ─────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────

const TABS = [
    { id: 'dashboard', label: 'Dashboard', icon: ShoppingBag },
    { id: 'availability', label: 'Availability', icon: CheckCircle2 },
    { id: 'status', label: 'Partner Status', icon: Kanban },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'connections', label: 'Connections', icon: Truck },
    { id: 'hours', label: 'Hours', icon: Clock },
    { id: 'strategies', label: 'Strategies', icon: Settings },
];

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export function TakeoutPageClient(): React.JSX.Element {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isOnline, setIsOnline] = useState(true);

    return (
        <div className="font-inter flex min-h-screen flex-col bg-white px-10 py-4 tracking-[-0.04em]">
            {/* 1. Header Section */}
            <div className="mb-2 flex items-center justify-between py-6">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4 pr-10">
                        <div className="relative h-14 w-14 overflow-hidden rounded-full ring-2 ring-white ring-offset-2">
                            <div className="bg-brand-accent flex h-full w-full items-center justify-center rounded-full border-2 border-white text-black">
                                <ShoppingBag className="h-6 w-6" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-xl leading-none font-bold text-gray-900">
                                Takeout & Delivery
                            </h1>
                            <div className="flex w-fit items-center gap-1.5 py-1 text-xs font-semibold text-gray-500">
                                <div
                                    className={cn(
                                        'h-1.5 w-1.5 rounded-full shadow-[0_0_8px_rgba(221,248,83,0.8)]',
                                        isOnline
                                            ? 'bg-brand-accent'
                                            : 'bg-red-500 shadow-red-500/50'
                                    )}
                                />
                                {isOnline ? 'Online Ordering: Active' : 'Snoozed'}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-0">
                        <div className="flex flex-col gap-1 pr-10">
                            <span className="text-sm font-semibold text-gray-500">
                                Active Orders
                            </span>
                            <span className="text-sm leading-none font-bold text-gray-900">
                                12 Orders
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 border-l border-gray-200 pr-10 pl-10">
                            <span className="text-sm font-semibold text-gray-500">
                                Kitchen Load
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm leading-none font-bold text-gray-900">
                                    8 / 15
                                </span>
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                                    <div className="bg-brand-accent h-full w-[53%]" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="group relative">
                        <button
                            className={cn(
                                'flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition-all outline-none active:scale-95',
                                isOnline
                                    ? 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                                    : 'border-red-100 bg-red-50 text-red-600 hover:bg-red-100'
                            )}
                        >
                            {isOnline ? (
                                <PauseCircle className="h-4 w-4" />
                            ) : (
                                <PlayCircle className="h-4 w-4" />
                            )}
                            {isOnline ? 'Snooze Ordering' : 'Resume Ordering'}
                            <ChevronDown className="ml-1 h-4 w-4 opacity-50" />
                        </button>

                        {/* Snooze Dropdown - Simplified for UI demo */}
                        <div className="absolute top-full right-0 z-50 mt-2 hidden w-48 rounded-2xl border border-gray-100 bg-white p-2 shadow-xl group-hover:block">
                            {['20 Minutes', '40 Minutes', '1 Hour', 'Until Tomorrow'].map(time => (
                                <button
                                    key={time}
                                    onClick={() => {
                                        setIsOnline(false);
                                        // duration logic would go here
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                    <Timer className="h-4 w-4" />
                                    {time}
                                </button>
                            ))}
                            <div className="my-1 border-t border-gray-50" />
                            <button
                                onClick={() => setIsOnline(true)}
                                className="text-brand-accent hover:bg-brand-accent/5 flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-bold"
                            >
                                <PlayCircle className="h-4 w-4" />
                                Resume Now
                            </button>
                        </div>
                    </div>
                    <button className="bg-brand-accent shadow-brand-accent/10 flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold text-black transition-all outline-none hover:brightness-105 active:scale-95">
                        <Save className="h-4 w-4" />
                        Save changes
                    </button>
                </div>
            </div>

            {/* 2. Navigation Tabs */}
            <div className="no-scrollbar mb-6 flex items-center gap-2 overflow-x-auto border-b border-gray-200">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'group relative flex items-center gap-2.5 px-4 py-4 text-sm font-medium whitespace-nowrap transition-all outline-none',
                            activeTab === tab.id
                                ? 'font-bold text-black after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-black'
                                : 'font-medium text-gray-400 hover:text-gray-600'
                        )}
                    >
                        <tab.icon
                            className={cn(
                                'h-4 w-4',
                                activeTab === tab.id
                                    ? 'text-black'
                                    : 'text-gray-400 group-hover:text-gray-600'
                            )}
                        />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 3. Content Area */}
            <div className="w-full pb-20">
                {activeTab === 'dashboard' && <DashboardView />}
                {activeTab === 'availability' && <AvailabilityView />}
                {activeTab === 'status' && <PartnerStatusView />}
                {activeTab === 'branding' && <BrandingView />}
                {activeTab === 'connections' && <ConnectionsView />}
                {activeTab === 'hours' && <HoursView />}
                {activeTab === 'strategies' && <StrategiesView />}
            </div>
        </div>
    );
}
