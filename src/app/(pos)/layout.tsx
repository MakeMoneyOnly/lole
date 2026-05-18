// Force dynamic rendering for all POS pages to avoid build-time errors
export const dynamic = 'force-dynamic';

import { CartProvider } from '@/context/CartContext';

export default function PosLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
    // This layout bypasses the main dashboard layout
    // No sidebar, no header. Just full screen PWA-style.
    return (
        <CartProvider>
            <div className="font-inter tracking-[-0.04em] min-h-screen bg-[#F7F5F2] text-[#1A1C1E]">
                {children}
            </div>
        </CartProvider>
    );
}

export const metadata = {
    title: 'lole POS',
    description: 'Point of Sale Terminal',
    themeColor: '#000000',
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
    },
};

