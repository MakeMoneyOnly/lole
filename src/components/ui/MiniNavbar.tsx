'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const AnimatedNavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const defaultTextColor = 'text-white/70 dark:text-gray-300';
    const hoverTextColor = 'text-white dark:text-white';
    const textSizeClass = 'text-sm font-bold';

    return (
        <a
            href={href}
            className={`group relative flex inline-block h-5 items-center overflow-hidden ${textSizeClass}`}
        >
            <div className="flex transform flex-col transition-transform duration-400 ease-out group-hover:-translate-y-1/2">
                <span className={defaultTextColor}>{children}</span>
                <span className={hoverTextColor}>{children}</span>
            </div>
        </a>
    );
};

export function MiniNavbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [headerShapeClass, setHeaderShapeClass] = useState('rounded-full');
    const shapeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    useEffect(() => {
        if (shapeTimeoutRef.current) {
            clearTimeout(shapeTimeoutRef.current);
        }

        if (isOpen) {
            setHeaderShapeClass('rounded-xl');
        } else {
            shapeTimeoutRef.current = setTimeout(() => {
                setHeaderShapeClass('rounded-full');
            }, 300);
        }

        return () => {
            if (shapeTimeoutRef.current) {
                clearTimeout(shapeTimeoutRef.current);
            }
        };
    }, [isOpen]);

    const logoElement = (
        <div className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute top-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 transform rounded-full bg-white dark:bg-gray-200"></span>
            <span className="absolute top-1/2 left-0 h-1.5 w-1.5 -translate-y-1/2 transform rounded-full bg-white dark:bg-gray-200"></span>
            <span className="absolute top-1/2 right-0 h-1.5 w-1.5 -translate-y-1/2 transform rounded-full bg-white dark:bg-gray-200"></span>
            <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 transform rounded-full bg-white dark:bg-gray-200"></span>
        </div>
    );

    const navLinksData = [
        { label: 'Features', href: '#features' },
        { label: 'Solutions', href: '#solutions' },
        { label: 'Pricing', href: '#pricing' },
    ];

    const loginButtonElement = (
        <Link href="/login">
            <button className="bg-foreground/10 text-foreground hover:bg-foreground/20 w-full rounded-full px-4 py-2 text-xs font-black shadow-sm transition-all duration-200 sm:w-auto sm:px-4 sm:text-sm dark:bg-white/10 dark:text-white/80 dark:hover:bg-white/20">
                LogIn
            </button>
        </Link>
    );

    const signupButtonElement = (
        <div className="group relative w-full sm:w-auto">
            <Link href="/signup">
                <button className="bg-foreground text-background relative z-10 w-full rounded-full px-4 py-2 text-xs font-black shadow-lg shadow-black/10 transition-all duration-200 hover:scale-105 sm:w-auto sm:px-4 sm:text-sm dark:bg-white dark:text-black">
                    Signup
                </button>
            </Link>
        </div>
    );

    return (
        <header
            className={cn(
                'fixed top-6 left-1/2 z-20 -translate-x-1/2 transform',
                'flex flex-col items-center',
                'px-6 py-3 backdrop-blur-3xl',
                headerShapeClass,
                'bg-black/80 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] dark:bg-black/80 dark:shadow-[0_20px_50px_-10px_rgba(255,255,255,0.05)]',
                'w-auto min-w-[280px] sm:min-w-0',
                'transition-all duration-300 ease-in-out'
            )}
        >
            <div className="flex w-full items-center justify-between gap-x-6 sm:gap-x-8">
                <div className="flex items-center">{logoElement}</div>

                <nav className="hidden items-center space-x-4 text-sm sm:flex sm:space-x-6">
                    {navLinksData.map(link => (
                        <AnimatedNavLink key={link.href} href={link.href}>
                            {link.label}
                        </AnimatedNavLink>
                    ))}
                </nav>

                <div className="hidden items-center gap-2 sm:flex sm:gap-3">
                    {loginButtonElement}
                    {signupButtonElement}
                </div>

                <button
                    className="flex h-8 w-8 items-center justify-center text-white focus:outline-none sm:hidden dark:text-gray-300"
                    onClick={toggleMenu}
                    aria-label={isOpen ? 'Close Menu' : 'Open Menu'}
                >
                    {isOpen ? (
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                            ></path>
                        </svg>
                    ) : (
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M4 6h16M4 12h16M4 18h16"
                            ></path>
                        </svg>
                    )}
                </button>
            </div>

            <div
                className={cn(
                    'flex w-full flex-col items-center overflow-hidden transition-all duration-300 ease-in-out sm:hidden',
                    isOpen
                        ? 'max-h-[1000px] pt-4 opacity-100'
                        : 'pointer-events-none max-h-0 pt-0 opacity-0'
                )}
            >
                <nav className="flex w-full flex-col items-center space-y-4 text-base">
                    {navLinksData.map(link => (
                        <AnimatedNavLink key={link.href} href={link.href}>
                            {link.label}
                        </AnimatedNavLink>
                    ))}
                </nav>
                <div className="mt-4 flex w-full flex-col items-center space-y-4">
                    {loginButtonElement}
                    {signupButtonElement}
                </div>
            </div>
        </header>
    );
}
