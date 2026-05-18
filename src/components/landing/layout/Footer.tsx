import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Instagram, Facebook, Linkedin, Youtube, Globe, ChevronDown } from 'lucide-react';

export function Footer(): React.JSX.Element {
    return (
        <div className="w-full p-3 md:p-4">
            <footer className="relative flex min-h-[400px] w-full flex-col justify-between overflow-hidden rounded-[1.5rem] bg-gradient-to-r from-[#170B05] via-[#481A05] to-[#E34105] px-8 pt-[60px] pb-[62px] md:rounded-4xl md:px-12 md:pt-[80px] md:pb-[78px] lg:px-16 lg:pt-[75px] lg:pb-[94px]">
                <div className="relative z-10 flex w-full -translate-y-[20px] flex-col justify-between gap-12 lg:flex-row lg:items-start">
                    {/* Left Column */}
                    <div className="flex flex-col justify-between gap-12 lg:gap-0">
                        <div className="flex translate-y-[45px] flex-col gap-14">
                            <div className="flex flex-col gap-4">
                                <Link
                                    href="/"
                                    className="relative block h-[90px] w-[300px] -translate-x-[25px] transition-opacity hover:opacity-90"
                                >
                                    <Image
                                        src="/logo.svg"
                                        alt="Lole"
                                        width={300}
                                        height={350}
                                        className="absolute top-1/2 left-0 h-[350px] w-auto max-w-none origin-left -translate-y-1/2"
                                    />
                                </Link>
                            </div>
                            <div className="flex w-[350px] max-w-full -translate-x-[25px] items-center justify-center gap-5">
                                <Link
                                    href="#"
                                    aria-label="Instagram"
                                    className="text-white transition-colors hover:text-white/80"
                                >
                                    <Instagram className="h-5 w-5" />
                                </Link>
                                <Link
                                    href="#"
                                    aria-label="Facebook"
                                    className="text-white transition-colors hover:text-white/80"
                                >
                                    <Facebook className="h-5 w-5" />
                                </Link>
                                <Link
                                    href="#"
                                    aria-label="LinkedIn"
                                    className="text-white transition-colors hover:text-white/80"
                                >
                                    <Linkedin className="h-5 w-5" />
                                </Link>
                                <Link
                                    href="#"
                                    aria-label="TikTok"
                                    className="text-white transition-colors hover:text-white/80"
                                >
                                    <svg
                                        className="h-5 w-5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    >
                                        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path>
                                    </svg>
                                </Link>
                                <Link
                                    href="#"
                                    aria-label="YouTube"
                                    className="text-white transition-colors hover:text-white/80"
                                >
                                    <Youtube className="h-6 w-6" />
                                </Link>
                            </div>
                        </div>

                        {/* Language Selector */}
                        <div
                            role="button"
                            tabIndex={0}
                            aria-label="Select language"
                            className="mt-auto flex w-fit translate-y-[40px] cursor-pointer items-center gap-1.5 pt-20 text-white hover:text-white/80 lg:translate-y-[90px]"
                        >
                            <Globe className="h-3.5 w-3.5" />
                            <span className="text-sm font-normal">English</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                        </div>
                    </div>

                    {/* Right Columns (Links Grid) */}
                    <div className="flex flex-1 flex-col gap-10 md:flex-row md:gap-x-8">
                        {/* Col 1 */}
                        <div className="flex flex-1 flex-col gap-4">
                            <h3 className="text-[18px] font-medium text-[#DDF853]">
                                Business types
                            </h3>
                            <div className="flex flex-col gap-2.5">
                                {[
                                    'Restaurants',
                                    'Bars & Clubs',
                                    'Cafes & Bakeries',
                                    'Quick Service',
                                    'Events & Venues',
                                ].map(link => (
                                    <Link
                                        key={link}
                                        href="#"
                                        className="text-[14px] font-medium text-white/80 transition-colors hover:text-white"
                                    >
                                        {link}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Col 2 */}
                        <div className="flex flex-1 flex-col gap-4">
                            <h3 className="text-[18px] font-medium text-[#DDF853]">Features</h3>
                            <div className="flex flex-col gap-2.5">
                                {[
                                    'Point of Sale',
                                    'Reservations',
                                    'Kitchen Display',
                                    'Payments',
                                    'QR ordering',
                                    'Inventory',
                                    'Insights',
                                ].map(link => (
                                    <Link
                                        key={link}
                                        href="#"
                                        className="text-[14px] font-medium text-white/80 transition-colors hover:text-white"
                                    >
                                        {link}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Col 3 */}
                        <div className="flex flex-1 flex-col gap-4">
                            <h3 className="text-[18px] font-medium text-[#DDF853]">Company</h3>
                            <div className="flex flex-col gap-2.5">
                                {['About', 'Pricing', 'Blog', 'Careers', 'Refer a friend'].map(
                                    link => (
                                        <Link
                                            key={link}
                                            href="#"
                                            className="text-[14px] font-medium text-white/80 transition-colors hover:text-white"
                                        >
                                            {link}
                                        </Link>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Col 4 */}
                        <div className="flex flex-1 flex-col gap-4">
                            <h3 className="text-[18px] font-medium text-[#DDF853]">Resources</h3>
                            <div className="flex flex-col gap-2.5">
                                {[
                                    'Privacy Policy',
                                    'Changelog',
                                    'Terms of Use',
                                    'Help Center',
                                    'Support',
                                    'Status',
                                ].map(link => (
                                    <Link
                                        key={link}
                                        href="#"
                                        className="text-[14px] font-medium text-white/80 transition-colors hover:text-white"
                                    >
                                        {link}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Copyright */}
                <div className="relative z-10 mt-10 flex w-full translate-y-[20px] justify-end lg:absolute lg:right-12 lg:bottom-[40px] lg:mt-0 lg:w-auto">
                    <div className="flex flex-col items-end gap-1 text-white/60">
                        <span className="text-xs font-normal">
                            © {new Date().getFullYear()} Lole Inc.
                        </span>
                        <Link
                            href="#"
                            className="text-[11px] font-normal transition-colors hover:text-white"
                        >
                            Cookie Settings
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
