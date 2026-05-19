'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import {
    LayoutGrid,
    ShoppingBag,
    UtensilsCrossed,
    QrCode,
    Users,
    Settings,
    LogOut,
    HelpCircle,
    BarChart3,
    Megaphone,
    ChefHat,
    Plug,
    Wallet,
    CreditCard,
    Landmark,
    Store,
    User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/context/SidebarContext';
import { motion, AnimatePresence } from 'framer-motion';
interface SidebarTooltipProps {
    children: React.ReactNode;
    label: string;
}

function SidebarTooltip({ children, label }: SidebarTooltipProps): React.JSX.Element {
    const [isVisible, setIsVisible] = React.useState(false);
    const [coords, setCoords] = React.useState({ top: 0, left: 0 });
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const { isCollapsed } = useSidebar();

    // Early return if not collapsed
    if (!isCollapsed) return <React.Fragment>{children}</React.Fragment> as React.JSX.Element;

    const handleMouseEnter = (): void => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            // Position the tooltip at the center-right of the trigger
            setCoords({
                top: rect.top + rect.height / 2,
                left: rect.right + 12,
            });
        }
        setIsVisible(true);
    };

    return (
        <div
            ref={triggerRef}
            className="relative flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible &&
                typeof document !== 'undefined' &&
                createPortal(
                    <AnimatePresence>
                        <motion.div
                            initial={{ opacity: 0, x: -10, y: '-50%' }}
                            animate={{ opacity: 1, x: 0, y: '-50%' }}
                            exit={{ opacity: 0, x: -10, y: '-50%' }}
                            transition={{ duration: 0.15, ease: 'easeOut' }}
                            style={{
                                top: coords.top,
                                left: coords.left,
                                position: 'fixed',
                            }}
                            className="pointer-events-none z-[9999] rounded-md bg-black px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-2xl"
                        >
                            {label}
                            {/* Triangle arrow */}
                            <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-y-[4px] border-r-[4px] border-y-transparent border-r-black" />
                        </motion.div>
                    </AnimatePresence>,
                    document.body
                )}
        </div>
    );
}

const SECTIONS = [
    {
        title: 'OVERVIEW',
        items: [
            { label: 'Home', href: '/merchant', icon: LayoutGrid },
            { label: 'Reports', href: '/merchant/reports', icon: BarChart3 },
        ],
    },
    {
        title: 'OPERATIONS',
        items: [
            { label: 'Menus', href: '/merchant/menus', icon: UtensilsCrossed },
            { label: 'Takeout & Delivery', href: '/merchant/takeout', icon: ShoppingBag },
            { label: 'Front of House', href: '/merchant/front-of-house', icon: QrCode },
            { label: 'Kitchen', href: '/merchant/kitchen', icon: ChefHat },
        ],
    },
    {
        title: 'PEOPLE & FINANCE',
        items: [
            { label: 'Employees', href: '/merchant/employees', icon: Users },
            { label: 'Payroll', href: '/merchant/payroll', icon: Wallet },
            { label: 'Payments', href: '/merchant/payments', icon: CreditCard },
        ],
    },
    {
        title: 'GROWTH',
        items: [{ label: 'Marketing', href: '/merchant/marketing', icon: Megaphone }],
    },
    {
        title: 'PLATFORM',
        items: [
            { label: 'Financial Products', href: '/merchant/financial-products', icon: Landmark },
            { label: 'Integrations', href: '/merchant/integrations', icon: Plug },
        ],
    },
];

const BOTTOM_LINKS = [
    { href: '/merchant/shop', icon: Store, label: 'Shop' },
    { href: '/merchant/help-support', icon: HelpCircle, label: 'Help & Support' },
    { href: '/merchant/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar(): React.JSX.Element {
    const pathname = usePathname();
    const { isCollapsed } = useSidebar();

    return (
        <aside
            className={cn(
                // Fixed, full-height, scrollable, hidden on mobile
                'no-scrollbar relative z-50 hidden h-full flex-col justify-between',
                'overflow-x-hidden overflow-y-auto',
                'border-r border-[#F1F1F1] bg-white',
                // GPU-composited width transition — translateZ(0) promotes to own layer
                // cubic-bezier(0.4,0,0.2,1) = fast start, smooth deceleration (Material standard)
                'transition-[width] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
                '[transform:translateZ(0)] will-change-[width]',
                'md:flex',
                isCollapsed ? 'w-[72px] px-2 pb-4' : 'w-[280px] px-4 pb-6'
            )}
        >
            {/* ── Top section ── */}
            <div className="space-y-6">
                {/* Logo */}
                <div className="flex h-[88px] w-full items-center">
                    <div className="relative flex w-full items-center">
                        {/* Full wordmark — visible when expanded */}
                        <div
                            className={cn(
                                'flex items-center pl-3 transition-[opacity] duration-300 ease-in-out',
                                isCollapsed ? 'pointer-events-none opacity-0' : 'opacity-100'
                            )}
                        >
                            <Image
                                src="/logo-black.svg"
                                alt="Lole"
                                width={110}
                                height={40}
                                className="h-20 w-auto object-contain"
                                priority
                            />
                        </div>

                        {/* Monogram — visible when collapsed */}
                        <div
                            className={cn(
                                'absolute left-1/2 -translate-x-1/2',
                                'flex h-10 w-10 items-center justify-center rounded-xl bg-black text-xl font-bold text-white',
                                'transition-[opacity] duration-300 ease-in-out',
                                isCollapsed ? 'opacity-100' : 'pointer-events-none opacity-0'
                            )}
                        >
                            L
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className={cn('px-1', isCollapsed ? 'space-y-4' : 'space-y-6')}>
                    {SECTIONS.map((section, idx) => (
                        <div
                            key={section.title}
                            className={cn(isCollapsed ? 'space-y-2' : 'space-y-1.5')}
                        >
                            {/* Header or Divider */}
                            {isCollapsed ? (
                                idx > 0 && <div className="mx-2 h-px bg-gray-100" />
                            ) : (
                                <h3
                                    className={cn(
                                        'px-4 text-[10px] leading-none font-bold tracking-[-0.04em] text-gray-500 uppercase',
                                        'overflow-hidden whitespace-nowrap',
                                        'transition-[opacity] duration-[150ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
                                        isCollapsed
                                            ? 'pointer-events-none opacity-0 select-none'
                                            : 'opacity-100'
                                    )}
                                >
                                    {section.title}
                                </h3>
                            )}

                            <div className="space-y-1">
                                {section.items.map(item => {
                                    const isActive =
                                        item.href === '/merchant'
                                            ? pathname === '/merchant'
                                            : pathname.startsWith(item.href);
                                    const Icon = item.icon;

                                    const linkContent = (
                                        <Link
                                            key={item.label}
                                            href={item.href}
                                            className={cn(
                                                'group flex items-center rounded-xl transition-all duration-200 ease-in-out',
                                                isCollapsed
                                                    ? 'justify-center p-2.5'
                                                    : 'px-4 py-2.5',
                                                isActive
                                                    ? 'bg-gray-100 text-black'
                                                    : 'text-gray-500 hover:bg-gray-50 hover:text-black'
                                            )}
                                        >
                                            <Icon
                                                className={cn(
                                                    'h-[22px] w-[22px] shrink-0 transition-colors duration-200',
                                                    isActive
                                                        ? 'text-black'
                                                        : 'text-gray-400 group-hover:text-black'
                                                )}
                                                strokeWidth={isActive ? 2 : 1.5}
                                            />

                                            {!isCollapsed && (
                                                <span
                                                    className={cn(
                                                        'ml-3 block overflow-hidden text-sm tracking-[-0.04em] whitespace-nowrap',
                                                        isActive
                                                            ? 'font-semibold text-black'
                                                            : 'font-medium text-gray-500 group-hover:text-black'
                                                    )}
                                                >
                                                    {item.label}
                                                </span>
                                            )}
                                        </Link>
                                    );

                                    return isCollapsed ? (
                                        <SidebarTooltip key={item.label} label={item.label}>
                                            {linkContent}
                                        </SidebarTooltip>
                                    ) : (
                                        linkContent
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>

            {/* ── Bottom section ── */}
            <div className={cn('mt-auto space-y-1 border-t border-[#F1F1F1] pt-6')}>
                {BOTTOM_LINKS.map(link => {
                    const linkContent = (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                'group flex items-center rounded-xl transition-all duration-200 hover:bg-gray-50',
                                isCollapsed ? 'justify-center p-2.5' : 'px-4 py-2.5',
                                pathname === link.href ? 'bg-gray-100 text-black' : 'text-gray-500'
                            )}
                        >
                            <link.icon
                                className={cn(
                                    'h-[22px] w-[22px] shrink-0 transition-colors duration-200',
                                    pathname === link.href
                                        ? 'text-black'
                                        : 'text-gray-400 group-hover:text-black'
                                )}
                                strokeWidth={pathname === link.href ? 2 : 1.5}
                            />
                            {!isCollapsed && (
                                <span
                                    className={cn(
                                        'ml-3 block overflow-hidden text-sm font-medium tracking-[-0.04em] whitespace-nowrap',
                                        pathname === link.href
                                            ? 'font-semibold text-black'
                                            : 'text-gray-500 group-hover:text-black'
                                    )}
                                >
                                    {link.label}
                                </span>
                            )}
                        </Link>
                    );

                    return isCollapsed ? (
                        <SidebarTooltip key={link.href} label={link.label}>
                            {linkContent}
                        </SidebarTooltip>
                    ) : (
                        linkContent
                    );
                })}

                {/* Logout */}
                <button
                    className={cn(
                        'group flex w-full items-center rounded-xl text-left transition-colors duration-200 hover:bg-red-50',
                        isCollapsed ? 'justify-center p-2.5' : 'px-4 py-2.5'
                    )}
                    onClick={() => {
                        window.location.href = '/login';
                    }}
                >
                    <User
                        className="h-[22px] w-[22px] shrink-0 text-gray-400 transition-colors duration-200 group-hover:text-red-400"
                        strokeWidth={1.5}
                    />
                    {!isCollapsed && (
                        <>
                            <span className="ml-3 block overflow-hidden text-sm font-medium tracking-[-0.04em] whitespace-nowrap text-gray-500 group-hover:text-red-500">
                                Logout
                            </span>
                            <LogOut
                                className="ml-auto h-[22px] w-[22px] shrink-0 text-red-500"
                                strokeWidth={1.5}
                            />
                        </>
                    )}
                </button>
            </div>
        </aside>
    );
}
