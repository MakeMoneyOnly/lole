'use client';

import React, { useState, useEffect, useRef } from 'react';

// Component Imports
import { Header } from '@/components/landing/layout/Header';
import { HeroSection } from '@/components/landing/sections/HeroSection';
import { TestimonialsSection } from '@/components/landing/sections/TestimonialsSection';
import { BusinessTypesSection } from '@/components/landing/sections/BusinessTypesSection';
import { FeaturesGallerySection } from '@/components/landing/sections/FeaturesGallerySection';
import { PricingSection } from '@/components/landing/sections/PricingSection';
import { FaqSection } from '@/components/landing/sections/FaqSection';
import { Footer } from '@/components/landing/layout/Footer';

import { LenisRoot } from '@/components/providers/LenisRoot';
import { OfflineIndicator } from '@/components/providers/OfflineIndicator';

export default function LandingPage(): React.JSX.Element {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
    const [billPlan, setBillPlan] = useState<'monthly' | 'annually'>('monthly');
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const businessScrollRef = useRef<HTMLDivElement>(null);
    const operatorsScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = (): void => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollBusiness = (direction: 'left' | 'right'): void => {
        if (!businessScrollRef.current) return;
        const scrollAmount = 400;
        businessScrollRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        });
    };

    const scrollOperators = (direction: 'left' | 'right'): void => {
        if (!operatorsScrollRef.current) return;
        const scrollAmount = 400;
        operatorsScrollRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth',
        });
    };

    return (
        <LenisRoot>
            <OfflineIndicator position="top" showSyncStatus={true} />
            <main
                id="main-content"
                className="font-inter relative flex min-h-screen w-full flex-col bg-white tracking-[-0.07em] text-gray-900 antialiased"
                tabIndex={-1}
            >
                <Header
                    isScrolled={isScrolled}
                    isFeaturesOpen={isFeaturesOpen}
                    setIsFeaturesOpen={setIsFeaturesOpen}
                />

                <HeroSection />

                <div className="relative flex w-full flex-col bg-[#F5F5F3]">
                    <TestimonialsSection
                        scrollRef={operatorsScrollRef}
                        onScroll={scrollOperators}
                    />

                    <BusinessTypesSection scrollRef={businessScrollRef} onScroll={scrollBusiness} />

                    <FeaturesGallerySection />

                    <PricingSection billPlan={billPlan} setBillPlan={setBillPlan} />

                    <FaqSection openFaq={openFaq} setOpenFaq={setOpenFaq} />

                    <Footer />
                </div>
            </main>
        </LenisRoot>
    );
}
