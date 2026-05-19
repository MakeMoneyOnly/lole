'use client';

import React from 'react';
import { useMerchantActivity } from '@/features/merchant/hooks/useMerchantActivity';
import { toast } from 'react-hot-toast';
import { ProfileSection } from './RightPanelProfile';
import { LoleChatbot } from '@/components/merchant/shared/LoleChatbot';

export function RightPanel(): React.JSX.Element {
    const { loading, restaurantName, restaurantHandle } = useMerchantActivity();

    const handleNotificationClick = (): void => {
        toast('No new notifications', { icon: '🔔' });
    };

    const handleMessageClick = (): void => {
        toast('No new messages', { icon: '💬' });
    };

    const handleMoreClick = (): void => {
        toast('Settings menu', { icon: '⚙️' });
    };

    return (
        <aside className="relative z-30 hidden h-full w-[380px] flex-col border-l border-[#F1F1F1] bg-white p-8 xl:flex">
            {/* Profile / Restaurant card — unchanged */}
            <ProfileSection
                restaurantName={restaurantName}
                restaurantHandle={restaurantHandle}
                loading={loading}
                onNotificationClick={handleNotificationClick}
                onMessageClick={handleMessageClick}
                onMoreClick={handleMoreClick}
            />

            {/* lole AI Agent chatbot */}
            <LoleChatbot />
        </aside>
    );
}
