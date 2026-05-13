import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ChevronDown, ArrowRight } from 'lucide-react';

const MegaMenuDropdown = dynamic(
    () => import('./MegaMenuDropdown').then(mod => mod.MegaMenuDropdown),
    { ssr: false }
);

interface HeaderProps {
    isScrolled: boolean;
    isFeaturesOpen: boolean;
    setIsFeaturesOpen: (open: boolean) => void;
}

export function Header({ isScrolled, isFeaturesOpen, setIsFeaturesOpen }: HeaderProps) {
    return (
        <div
            className={`fixed top-0 right-0 left-0 z-50 flex w-full justify-center transition-all duration-500 ease-in-out ${
                isScrolled ? 'px-4 py-4 md:px-8 md:py-6' : 'p-3 md:p-4'
            }`}
        >
            <header
                onMouseLeave={() => setIsFeaturesOpen(false)}
                className={`relative z-50 flex w-full flex-col transition-all duration-500 ease-in-out ${
                    isFeaturesOpen
                        ? isScrolled
                            ? 'max-w-6xl rounded-xl md:rounded-2xl'
                            : 'max-w-full rounded-xl md:rounded-2xl'
                        : isScrolled
                          ? 'max-w-6xl rounded-xl bg-[#8a887a]/95 shadow-xl backdrop-blur-md md:rounded-2xl'
                          : 'max-w-full rounded-xl bg-transparent md:rounded-2xl'
                }`}
            >
                {/* Header Top Row */}
                <div
                    className={`flex w-full items-center justify-between transition-all duration-500 ease-in-out ${
                        isScrolled ? 'px-6 py-4 md:px-10' : 'px-6 py-6 md:px-14 lg:px-20 lg:py-8'
                    }`}
                >
                    {/* Left: Logo & Links */}
                    <div className="flex items-center gap-8 md:gap-12">
                        {/* Logo */}
                        <Link
                            href="/"
                            className="relative flex h-8 w-24 translate-x-[20px] items-center transition-opacity hover:opacity-90 md:h-10 md:w-32"
                        >
                            <Image
                                src="/logo.svg"
                                alt="Lole"
                                width={128}
                                height={90}
                                className="absolute top-1/2 left-0 h-[74px] w-auto max-w-none origin-left -translate-y-1/2 md:h-[90px]"
                            />
                        </Link>

                        {/* Desktop Nav Links */}
                        <nav
                            className={`hidden items-center gap-6 transition-transform duration-500 ease-in-out lg:flex ${isScrolled ? '-translate-x-[20px]' : ''}`}
                        >
                            <div
                                onMouseEnter={() => setIsFeaturesOpen(true)}
                                className="relative -my-4 flex cursor-pointer items-center gap-1 py-4"
                            >
                                <span
                                    className={`flex items-center gap-1 rounded-[6px] px-3 py-1.5 text-[14px] leading-[21px] font-medium transition-colors ${
                                        isFeaturesOpen
                                            ? 'bg-[#DDF853] text-black'
                                            : 'text-white/90 hover:text-white'
                                    }`}
                                >
                                    Features
                                    <ChevronDown
                                        className={`h-3.5 w-3.5 transition-transform ${isFeaturesOpen ? 'rotate-180 text-black' : 'text-white/70'}`}
                                    />
                                </span>
                            </div>
                            {['Business types', 'Resources', 'Pricing', 'About'].map(
                                (item, idx) => (
                                    <Link
                                        key={idx}
                                        href="#"
                                        className={`flex items-center gap-1 text-[14px] leading-[21px] font-medium transition-colors ${
                                            isFeaturesOpen
                                                ? 'text-gray-800 hover:text-black'
                                                : 'text-white/90 hover:text-white'
                                        }`}
                                    >
                                        {item}
                                        {(item === 'Business types' || item === 'Resources') && (
                                            <ChevronDown
                                                className={`h-3.5 w-3.5 ${isFeaturesOpen ? 'text-gray-500' : 'text-white/70'}`}
                                            />
                                        )}
                                    </Link>
                                )
                            )}
                        </nav>
                    </div>

                    {/* Right: Actions */}
                    <div className="hidden items-center gap-4 md:flex">
                        <Link
                            href="/login"
                            className={`text-[14px] leading-[21px] font-medium transition-colors ${
                                isFeaturesOpen
                                    ? 'text-gray-800 hover:text-black'
                                    : 'text-white hover:text-white/80'
                            }`}
                        >
                            Log in
                        </Link>
                        <div
                            className={`h-3.5 w-px transition-colors ${isFeaturesOpen ? 'bg-gray-300' : 'bg-white/30'}`}
                        ></div>
                        <Link
                            href="/auth/signup"
                            className={`text-[14px] leading-[21px] font-medium transition-colors ${
                                isFeaturesOpen
                                    ? 'text-gray-800 hover:text-black'
                                    : 'text-white hover:text-white/80'
                            }`}
                        >
                            Get started
                        </Link>
                        <Link
                            href="/signup"
                            className="flex items-center gap-1.5 rounded-[16px] bg-[#DDF853] px-6 py-3 text-[14px] leading-[21px] font-medium text-black transition-colors hover:brightness-105"
                        >
                            Book a demo
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                {/* Mega Menu Dropdown Panel */}
                <MegaMenuDropdown isOpen={isFeaturesOpen} isScrolled={isScrolled} />
            </header>
        </div>
    );
}
