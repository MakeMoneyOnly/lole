'use client';

import React, { useState } from 'react';
import { Users, Briefcase, Clock, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TeamManagementTab } from './tabs/TeamManagementTab';
import { JobsTab } from './tabs/JobsTab';
import { TimeAttendanceTab } from './tabs/TimeAttendanceTab';
import { TipsTab } from './tabs/TipsTab';

const TABS = [
    { id: 'team', label: 'Team Management', icon: Users },
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'time', label: 'Time & Attendance', icon: Clock },
    { id: 'tips', label: 'Tips', icon: Banknote },
];

export function EmployeesPageClient(): React.JSX.Element {
    const [activeTab, setActiveTab] = useState('team');

    const titles: Record<string, { title: string; desc: string }> = {
        team: {
            title: 'Team Management',
            desc: 'Manage your staff directory, profiles, and basic access.',
        },
        jobs: {
            title: 'Job Roles & Permissions',
            desc: 'Define standard roles, wages, and system access levels.',
        },
        time: {
            title: 'Time & Attendance',
            desc: 'Manage timesheets, breaks, and Ethiopian labor law compliance.',
        },
        tips: {
            title: 'Tips & Pooling',
            desc: 'Configure tip rules, suggested amounts, and staff distribution pools.',
        },
    };

    return (
        <div className="font-inter flex min-h-screen flex-col bg-white px-10 py-8 tracking-[-0.04em]">
            {/* Dynamic Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">{titles[activeTab].title}</h1>
                <p className="mt-2 text-sm font-medium text-gray-500">{titles[activeTab].desc}</p>
            </div>

            {/* Navigation Tabs */}
            <div className="no-scrollbar mb-8 flex items-center gap-2 overflow-x-auto border-b border-gray-200">
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
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="w-full pb-20">
                {activeTab === 'team' && <TeamManagementTab />}
                {activeTab === 'jobs' && <JobsTab />}
                {activeTab === 'time' && <TimeAttendanceTab />}
                {activeTab === 'tips' && <TipsTab />}
            </div>
        </div>
    );
}
