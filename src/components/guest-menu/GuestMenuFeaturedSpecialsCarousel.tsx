'use client';

import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Autoplay } from 'swiper/modules';
import { MenuItem } from '@/app/(guest)/[slug]/menu-client';
import { GuestMenuRecommendedCard } from './GuestMenuRecommendedCard';

// Swiper core styles
import 'swiper/css';
import 'swiper/css/effect-coverflow';

interface GuestMenuFeaturedSpecialsCarouselProps {
    items: MenuItem[];
    onSelect: (item: MenuItem) => void;
    onAddToCart: (item: MenuItem) => void;
}

const PHOTO_SHOOT_IMAGES = [
    'https://res.cloudinary.com/dcm6m7d81/image/upload/v1779124030/pomelli_photoshoot_image_1_1_0518_txcvwm.jpg',
    'https://res.cloudinary.com/dcm6m7d81/image/upload/v1779124036/pomelli_photoshoot_image_1_1_0518_1_dpebeu.jpg',
    'https://res.cloudinary.com/dcm6m7d81/image/upload/v1779124041/pomelli_photoshoot_image_1_1_0518_3_kbpijk.jpg',
];

/**
 * Enterprise-Grade 3D Coverflow Carousel for Featured Specials.
 * Tailored exclusively for Mobile viewport with native guest gestures.
 */
export const GuestMenuFeaturedSpecialsCarousel: React.FC<
    GuestMenuFeaturedSpecialsCarouselProps
> = ({ items, onSelect, onAddToCart }) => {
    if (!items || items.length === 0) return null;

    return (
        <div className="relative w-full overflow-hidden py-4 select-none">
            {/* Ambient Background Glow matching Lole Brand style */}
            <div className="pointer-events-none absolute top-1/2 left-1/2 z-0 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#DDF853]/5 blur-[80px]" />

            <Swiper
                modules={[EffectCoverflow, Autoplay]}
                effect={'coverflow'}
                grabCursor={true}
                centeredSlides={true}
                slidesPerView={'auto'}
                initialSlide={1}
                loop={items.length > 2}
                autoplay={{
                    delay: 4000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true,
                }}
                coverflowEffect={{
                    rotate: 15,
                    stretch: -20,
                    depth: 150,
                    modifier: 1.2,
                    slideShadows: false,
                }}
                className="z-10 w-full !px-5"
                style={{ overflow: 'visible' }}
            >
                {items.map((item, index) => {
                    const itemWithPhotoShootImage = {
                        ...item,
                        imageUrl: PHOTO_SHOOT_IMAGES[index % PHOTO_SHOOT_IMAGES.length],
                    };
                    return (
                        <SwiperSlide
                            key={item.id}
                            className="!h-[280px] !w-[235px] transition-transform duration-300 ease-out"
                        >
                            <div className="h-full w-full transform transition-all duration-300">
                                <GuestMenuRecommendedCard
                                    item={itemWithPhotoShootImage}
                                    onSelect={onSelect}
                                    onAddToCart={onAddToCart}
                                />
                            </div>
                        </SwiperSlide>
                    );
                })}
            </Swiper>
        </div>
    );
};
