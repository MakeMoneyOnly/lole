'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    BarChart3,
    HelpCircle,
    LayoutGrid,
    QrCode,
    RadioTower,
    Settings,
    ShoppingBag,
    User,
    Users,
    UtensilsCrossed,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_MENU_ITEMS = [
    { label: 'Dashboard', href: '/merchant', icon: LayoutGrid },
    { label: 'Orders', href: '/merchant/orders', icon: ShoppingBag },
    { label: 'Menu', href: '/merchant/menu', icon: UtensilsCrossed },
    { label: 'Tables', href: '/merchant/tables', icon: QrCode },
    { label: 'Guests', href: '/merchant/guests', icon: User },
    { label: 'Channels', href: '/merchant/channels', icon: RadioTower },
    { label: 'Staff', href: '/merchant/staff', icon: Users },
    { label: 'Analytics', href: '/merchant/analytics', icon: BarChart3 },
    { label: 'Settings', href: '/merchant/settings', icon: Settings },
    { label: 'Help', href: '/merchant/help-support', icon: HelpCircle },
];

export function MobileBottomNav(): React.JSX.Element {
    const pathname = usePathname();

    return (
        <nav
            aria-label="Mobile merchant navigation"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/85 md:hidden"
            data-testid="mobile-bottom-nav"
        >
            <div className="grid grid-cols-4">
                {MOBILE_MENU_ITEMS.map(item => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex h-16 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition-colors',
                                isActive ? 'bg-gray-50 text-black' : 'text-gray-500'
                            )}
                            data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                        >
                            <Icon className="h-4 w-4" />
                            <span className="max-w-full truncate">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
