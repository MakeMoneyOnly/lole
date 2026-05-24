'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command, Search } from 'lucide-react';

type CommandItem = {
    id: string;
    label: string;
    run: () => void;
};

export function CommandBarShell(): React.JSX.Element {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');

    const commands = useMemo<CommandItem[]>(
        () => [
            { id: 'dashboard', label: 'Go to Dashboard', run: () => router.push('/merchant') },
            { id: 'orders', label: 'Go to Orders', run: () => router.push('/merchant/orders') },
            { id: 'tables', label: 'Go to Tables', run: () => router.push('/merchant/tables') },
            { id: 'menu', label: 'Go to Menu', run: () => router.push('/merchant/menu') },
            {
                id: 'channels',
                label: 'Go to Channels',
                run: () => router.push('/merchant/channels'),
            },
            { id: 'staff', label: 'Go to Staff', run: () => router.push('/merchant/staff') },
            {
                id: 'finance',
                label: 'Go to Finance & Reconciliation',
                run: () => router.push('/merchant/finance'),
            },
            {
                id: 'team-schedule',
                label: 'Open Team Schedule',
                run: () => router.push('/merchant/staff'),
            },
            {
                id: 'settings',
                label: 'Go to Settings',
                run: () => router.push('/merchant/settings'),
            },
            {
                id: 'open-alert-rules',
                label: 'Open Alert Rules Builder',
                run: () => window.dispatchEvent(new CustomEvent('merchant:open-alert-rules')),
            },
            {
                id: 'refresh-command-center',
                label: 'Refresh Command Center',
                run: () => window.dispatchEvent(new CustomEvent('merchant:command-center-refresh')),
            },
        ],
        [router]
    );

    const filtered = commands.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent): void => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                setOpen(value => !value);
            }
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="fixed bottom-5 left-[300px] z-40 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 shadow-lg hover:bg-gray-50"
            >
                <Command className="h-4 w-4" />
                Command Bar
                <span className="text-micro rounded-xs bg-gray-100 px-1.5 py-0.5 text-gray-600">
                    Ctrl K
                </span>
            </button>

            {open && (
                <div className="fixed inset-0 z-50 bg-black/40 p-4">
                    <div className="mx-auto mt-20 w-full max-w-xl rounded-xl border border-gray-100 bg-white p-3 shadow-2xl">
                        <div className="relative mb-3">
                            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                autoFocus
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                placeholder="Type a command..."
                                className="h-11 w-full rounded-xl border border-gray-200 pr-3 pl-9 text-sm outline-none focus:border-gray-400"
                            />
                        </div>

                        <div className="max-h-72 space-y-1 overflow-y-auto">
                            {filtered.length === 0 ? (
                                <p className="rounded-lg px-3 py-4 text-sm text-gray-500">
                                    No commands found.
                                </p>
                            ) : (
                                filtered.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            item.run();
                                            setOpen(false);
                                            setQuery('');
                                        }}
                                        className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
                                    >
                                        {item.label}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
