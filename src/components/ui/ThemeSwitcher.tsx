'use client';

import { usePathname } from 'next/navigation';
import { Theme } from '@/components/ui/theme';

export const ThemeSwitcher = (): React.JSX.Element | null => {
    const pathname = usePathname();

    // Only show on landing page
    if (pathname !== '/') return null;

    return (
        <div className="flex items-center gap-3">
            <Theme size="md" variant="dropdown" showLabel themes={['light', 'dark', 'system']} />
        </div>
    );
};
