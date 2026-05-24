'use client';

import React from 'react';
import { KitchenLoadCard } from '../KitchenLoadCard';
import { ActiveThrottleCard } from '../ActiveThrottleCard';
import { RecentOrdersCard } from '../RecentOrdersCard';

export function DashboardView(): React.JSX.Element {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <KitchenLoadCard />
                <ActiveThrottleCard />
            </div>
            <RecentOrdersCard />
        </div>
    );
}
