'use client';

import React from 'react';
import Image from 'next/image';

export const GuestMenuBannerCarousel: React.FC = () => {
    // In a real app, this would be a carousel (e.g. from framer-motion or a library)
    // For now, we'll implement a static premium banner matching the design.
    return (
        <div className="w-full px-5 py-3">
            <div className="relative aspect-[16/8] w-full overflow-hidden rounded-[24px] bg-white border border-brand-neutral-soft/10">
                <Image 
                    src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80" 
                    alt="Premium Banner"
                    fill
                    className="object-cover"
                />
                <div className="absolute inset-0 bg-black/10" />
            </div>
        </div>
    );
};
