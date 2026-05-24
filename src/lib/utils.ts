import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatETBCurrency } from '@/lib/format/et';

export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'ETB'): string {
    if (currency.toUpperCase() === 'ETB') {
        const formatted = formatETBCurrency(amount, {
            locale: 'en',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
        return formatted.replace(/ETB/g, 'Br.').trim();
    }

    return new Intl.NumberFormat('en-ET', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function isRemoteOrDataImageSrc(src: string): boolean {
    const normalized = src.trim().toLowerCase();

    // Data URLs: Always skip optimization
    if (normalized.startsWith('data:')) return true;

    // Local images (start with /): Always optimize
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
        return false;
    }

    try {
        const url = new URL(src);
        const optimizedDomains = ['axuegixbqsvztdraenkz.supabase.co', 'i.pravatar.cc'];

        // If domain is whitelisted, allow optimization (return false)
        if (optimizedDomains.includes(url.hostname)) {
            return false;
        }
    } catch {
        // Ignore invalid URLs
    }

    // Default: Skip optimization for unknown remote URLs
    return true;
}
