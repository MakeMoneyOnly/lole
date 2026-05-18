'use client';

import React, { useState } from 'react';
import { LayoutList, Layers, ListChecks, Settings, UploadCloud, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MenuManagerTab } from './tabs/MenuManagerTab';
import { ModifierGroupsTab } from './tabs/ModifierGroupsTab';
import { MenuBulkEditTab } from './tabs/MenuBulkEditTab';
import { MenuConfigurationTab } from './tabs/MenuConfigurationTab';
import { PublishChangesTab } from './tabs/PublishChangesTab';

const TABS = [
    { id: 'manager', label: 'Menu Manager', icon: LayoutList },
    { id: 'modifiers', label: 'Modifier Groups', icon: Layers },
    { id: 'bulk-edit', label: 'Bulk Edit', icon: ListChecks },
    { id: 'config', label: 'Configuration', icon: Settings },
    { id: 'publish', label: 'Publish Changes', icon: UploadCloud, badge: 3 },
];

export function MenusPageClient({ initialData }: { initialData?: unknown }): React.JSX.Element {
    const [activeTab, setActiveTab] = useState('manager');

    return (
        <div className="font-inter flex min-h-screen flex-col bg-white px-10 py-4 tracking-[-0.04em]">
            {/* 1. Header Section */}
            <div className="mb-2 flex items-center justify-between py-6 pl-[60px]">
                <div className="flex items-center gap-6">
                    <div className="space-y-1">
                        <h1 className="text-3xl leading-none font-bold text-gray-900">Menus</h1>
                        <p className="mt-1 text-sm font-medium text-gray-500">
                            Manage categories, items, and pricing
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <button className="bg-brand-accent shadow-brand-accent/10 hover: flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-bold text-black transition-all hover:brightness-105 active:scale-95">
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
                            'group relative flex items-center gap-2.5 px-4 py-4 text-sm font-medium whitespace-nowrap transition-all',
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
                        {tab.badge && (
                            <span className="ml-1 rounded-full bg-[#DDF853] px-2 py-0.5 text-[10px] font-bold text-black">
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* 3. Content Area */}
            <div className="w-full pb-20">
                {activeTab === 'manager' && <MenuManagerTab initialData={initialData} />}
                {activeTab === 'modifiers' && <ModifierGroupsTab />}
                {activeTab === 'bulk-edit' && <MenuBulkEditTab initialData={initialData} />}
                {activeTab === 'config' && <MenuConfigurationTab />}
                {activeTab === 'publish' && <PublishChangesTab />}
            </div>
        </div>
    );
}
